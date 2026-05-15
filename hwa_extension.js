// ==UserScript==
// @name         Dungeon runner
// @namespace    http://tampermonkey.net/
// @version      2026-05-14
// @description  try to take over the world!
// @author       You
// @match        https://www.hero-wars-alliance.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hero-wars-alliance.com
// @grant        none
// ==/UserScript==

(async function() {
    'use strict';

    window.addEventListener('unhandledrejection', (e) => {
        const msg = String(e.reason);
        if (msg.includes('OOM') || msg.includes('memory access out of bounds') || msg.includes('Internal Server Error')) {
            location.reload();
        }
    });

    const originalError = console.error;
    console.error = function (...args) {
        const msg = args.join(' ');
        if (msg.includes('OOM') || msg.includes('memory access out of bounds') || msg.includes('Internal Server Error')) {
            location.reload();
        }
        return originalError.apply(console, args);
    };

    const check = setInterval(async () => {
        const canvas = document.getElementById('gameCanvas')
        if (canvas) {
            clearInterval(check)
            setTimeout(async () => await startMainScript(canvas), 20000)
        }
    }, 200)

    async function startMainScript(gameCanvas) {
        /// VERSION 1.0.5
        /// MACRO RUNNER - PASTE THIS CODE IN CONSOLE ONLY ONCE
        /// Send your ideas for improvements to Deidara/Phoenix Rebirth at Discord: @int021h
        const DEBUG_CLICKS = false

        let gameArea = gameCanvas.getBoundingClientRect()
        let canvasScaleX = gameCanvas.width / gameArea.width
        let canvasScaleY = gameCanvas.height / gameArea.height

        // MACRO stuff
        const actionClick = 1
        const actionDelay = 2
        const actionChooseRoom = 3
        const actionTitle = 4
        const actionWaitForColor = 5
        const actionInterruptIfColor = 6
        const actionJump = 7

        let isRunningMacro = false
        let lvlTitle = ""

        const sleep = ms => new Promise(r => setTimeout(r, ms))

        // Pixel color picker
        const colorsMatchThreshold = 10
        const gl = gameCanvas.getContext('webgl2')
        let readPixelsOnce = 0
        let readX = 0
        let readY = 0
        const pixels = new Uint8Array(4)
        let pendingRead = null
        const originalRAF = window.requestAnimationFrame.bind(window)
        window.requestAnimationFrame = function(callback) {
            return originalRAF(function(time) {
                try {
                    callback(time)
                } finally {
                }

                const req = pendingRead
                if (!req) return
                pendingRead = null

                gl.readPixels(
                    req.x,
                    gl.canvas.height - req.y,
                    1,
                    1,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    pixels
                )

                req.resolve([
                    pixels[0],
                    pixels[1],
                    pixels[2],
                    pixels[3]
                ])
            })
        }

        function readPixelOnDraw(x, y) {
            return new Promise(resolve => {
                pendingRead = { x, y, resolve }
            })
        }

        let wakeLock = null
        async function enableWakeLock() {
            try {
                wakeLock = await navigator.wakeLock.request('screen')
                console.log('Wake Lock enabled')
                wakeLock.addEventListener('release', () => {
                    console.log('Wake Lock released')
                })
            } catch (err) {
                console.error(err)
            }
        }

        async function releaseWakeLock() {
            await wakeLock.release()
            wakeLock = null
        }

        // ROOM Element detection
        function getElementName(category) {
            if (category == 1) return 'Fire'
            if (category == 2) return 'Earth'
            if (category == 3) return 'Water'
            if (category == 4) return 'Mixed'
            return '?'
        }

        function getColorCategory(pixel) {
            const [r, g, b, a] = pixel
            if (r > 195 && r < 240 && g > 200 && b < 100) {
                return 4 // gray
            }
            if (r >= g && r >= b) {
                return 1 // red
            }
            if (g >= r && g >= b) {
                return 2 // green
            }
            return 3 // blue
        }

        function colorsAreSame(color1, color2, threshold = colorsMatchThreshold) {
            if (Math.abs(color1[0] - color2[0]) > threshold) return false
            if (Math.abs(color1[1] - color2[1]) > threshold) return false
            if (Math.abs(color1[2] - color2[2]) > threshold) return false
            return true
        }

        function setDungeonButtonState(running) {
            const button = document.getElementById('dungeonMacroButton')
            if (running) {
                button.textContent = 'Stop Dungeon'
                button.style.background = 'linear-gradient(180deg, #ff8a7a 0%, #b3261e 55%, #5e0d0d 100%)'
                button.style.border = '1px solid #ffb0a8'
                button.style.boxShadow = '0 0 12px rgba(255,70,70,0.45), inset 0 1px 0 rgba(255,255,255,0.18)'
                button.style.color = '#fff0f0'
                button.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)'
            } else {
                button.textContent = 'Run Dungeon'
                button.style.background = 'linear-gradient(180deg, #ffe08a 0%, #d08b18 55%, #8f5310 100%)'
                button.style.border = '1px solid #ffcf66'
                button.style.boxShadow = '0 0 10px rgba(255,180,50,0.35), inset 0 1px 0 rgba(255,255,255,0.25)'
                button.style.color = '#fff6d6'
                button.style.textShadow = '0 1px 2px rgba(0,0,0,0.7)'
            }
        }

        function addNiceToolbar() {
            const floors = restoreInt("maxFloors", 1000)
            const hpLimit = restoreInt("stopHPLimit", 0)

            const container = document.createElement('span')
            container.style.display = 'inline-flex'
            container.style.alignItems = 'center'
            container.style.gap = '6px'
            container.style.padding = '4px 10px'
            container.style.marginLeft = '12px'
            container.style.border = '1px solid rgba(120,180,255,0.35)'
            container.style.borderRadius = '10px'
            container.style.background = 'linear-gradient(180deg, rgba(20,30,55,0.92) 0%, rgba(8,12,25,0.92) 100%)'
            container.style.boxShadow = '0 0 12px rgba(0,140,255,0.18)'
            container.style.color = '#d9ecff'
            container.style.fontSize = '14px'
            container.style.fontFamily = 'Trebuchet MS, Verdana, sans-serif'
            container.style.backdropFilter = 'blur(2px)'

            const selectStyle = (el) => {
                el.style.background = 'linear-gradient(180deg, #31486d 0%, #1a2740 100%)'
                el.style.color = '#eef7ff'
                el.style.border = '1px solid #5ea8ff'
                el.style.borderRadius = '6px'
                el.style.padding = '2px 6px'
                el.style.outline = 'none'
                el.style.cursor = 'pointer'
                el.style.boxShadow = '0 0 6px rgba(80,160,255,0.25)'
            }


            const selectFloors = document.createElement('select')
            selectFloors.id = 'maxFloors'
            selectStyle(selectFloors)

            const floors1 = document.createElement('option')
            floors1.value = '1'
            floors1.selected = floors == 1
            floors1.textContent = '1'

            const floors5 = document.createElement('option')
            floors5.value = '5'
            floors5.selected = floors == 5
            floors5.textContent = '5'

            const floors10 = document.createElement('option')
            floors10.value = '10'
            floors10.selected = floors == 10
            floors10.textContent = '10'

            const floors20 = document.createElement('option')
            floors20.value = '20'
            floors20.selected = floors == 20
            floors20.textContent = '20'

            const floors100 = document.createElement('option')
            floors100.value = '100'
            floors100.selected = floors == 100
            floors100.textContent = '100'

            const floors1000 = document.createElement('option')
            floors1000.value = '1000'
            floors1000.selected = floors == 1000
            floors1000.textContent = '1000'

            selectFloors.append(
                floors1,
                floors5,
                floors10,
                floors20,
                floors100,
                floors1000
            )

            const select = document.createElement('select')
            select.id = 'stopHPLimit'
            selectStyle(select)

            const option1 = document.createElement('option')
            option1.value = '0'
            option1.textContent = 'If titan dies'
            option1.selected = hpLimit == 0
            const option2 = document.createElement('option')
            option2.value = '30'
            option2.selected = hpLimit == 30
            option2.textContent = 'If HP < 30%'
            const option3 = document.createElement('option')
            option3.value = '50'
            option3.selected = hpLimit == 50
            option3.textContent = 'If HP < 50%'
            const option4 = document.createElement('option')
            option4.value = '100'
            option4.selected = hpLimit == 100
            option4.textContent = 'Never'
            select.append(option1, option2, option3, option4)

            const button = document.createElement('button')
            button.id = 'dungeonMacroButton'
            button.textContent = 'Run Dungeon'
            button.style.background = 'linear-gradient(180deg, #ffe08a 0%, #d08b18 55%, #8f5310 100%)'
            button.style.color = '#fff6d6'
            button.style.border = '1px solid #ffcf66'
            button.style.borderRadius = '8px'
            button.style.padding = '4px 12px'
            button.style.fontWeight = 'bold'
            button.style.cursor = 'pointer'
            button.style.textShadow = '0 1px 2px rgba(0,0,0,0.7)'
            button.style.boxShadow = '0 0 10px rgba(255,180,50,0.35), inset 0 1px 0 rgba(255,255,255,0.25)'
            button.style.transition = '0.15s ease'

            button.onmouseenter = () => {
                button.style.filter = 'brightness(1.12)'
            }
            button.onmouseleave = () => {
                button.style.filter = 'brightness(1)'
            }
            button.addEventListener('click', runDungeonMacro)

            const createIndicator = (id, text, color) => {
                const el = document.createElement('span')
                el.id = id
                el.textContent = text
                el.style.fontWeight = 'bold'
                el.style.color = color
                el.style.textShadow = `0 0 8px ${color}`
                return el
            }
            const roomLeft = createIndicator('roomLeft', 'LEFT', '#6fd3ff')

            const roomDecision = document.createElement('span')
            roomDecision.id = 'roomDecision'
            roomDecision.textContent = '?'
            roomDecision.style.fontWeight = 'bold'
            roomDecision.style.color = '#ffd86a'
            roomDecision.style.textShadow = '0 0 10px rgba(255,216,106,0.7)'

            const roomRight = createIndicator('roomRight', 'RIGHT', '#ff8f8f')
            container.appendChild(document.createTextNode('Max floors:'))
            container.appendChild(selectFloors)
            container.appendChild(document.createTextNode('Stop:'))
            container.appendChild(select)
            container.appendChild(button)
            container.appendChild(roomLeft)
            container.appendChild(roomDecision)
            container.appendChild(roomRight)

            const header = document.getElementById('header')
            header.insertBefore(container, header.children[1])

            setDungeonButtonState(false)
        }

        /// MACRO RUNNER
        async function runActions(actions, maxRetries = 1) {
            const target = gameCanvas

            let skipUntilAction = null
            let skipActions = 0
            let prevClickAction = actions[0]
            for (const action of actions) {
                if (!isRunningMacro) return

                if (skipActions > 0) {
                    skipActions--
                    continue
                }

                const {
                    x = 0,
                    y = 0,
                    xx = [],
                    color = [],
                    altX = 0,
                    delay = 0,
                    title = "",
                    actionType = actionClick
                } = action

                if (skipUntilAction) {
                    if (title == skipUntilAction) {
                        skipUntilAction = null
                    } else {
                        continue
                    }
                }

                if (actionType == actionTitle) {
                    lvlTitle = title
                    continue
                }

                if (title != "" && actionType != actionJump) {
                    document.title = lvlTitle + ": " + title
                    console.log(document.title)
                }

                if (actionType == actionDelay) {
                    if (delay > 0) {
                        await sleep(delay)
                    }
                } else if (actionType == actionInterruptIfColor) {
                    for (let i = 0; i<xx.length; i++) {
                        let testPixel = []
                        testPixel = await readPixelOnDraw(
                            gameArea.width * xx[i] * canvasScaleX,
                            gameArea.height * y * canvasScaleY,
                        )
                        if (colorsAreSame(testPixel, color)) {
                            isRunningMacro = false
                            console.log(lvlTitle, ":", i+1, "titan's HP is tooo low to continue")
                            return
                        }
                    }
                } else if (actionType == actionJump) {
                    let testPixel = await readPixelOnDraw(
                        gameArea.width * x * canvasScaleX,
                        gameArea.height * y * canvasScaleY,
                    )
                    if (colorsAreSame(testPixel, color, 10)) {
                        skipUntilAction = title
                        console.log("skipping actions until:", title, " // ", testPixel[0], testPixel[1], testPixel[2], "!=", color[0], color[1], color[2])
                    } else {
                        console.log("this action is not for this gate:", title, " // ", testPixel[0], testPixel[1], testPixel[2], "=", color[0], color[1], color[2])
                        //await runUnityInput(target, x, y)
                        sleep(100)
                    }
                } else if (actionType == actionWaitForColor) {
                    let retries = maxRetries
                    let maxDelay = 5000
                    let pixel = []
                    do {
                        await sleep(delay)
                        maxDelay -= delay

                        pixel = await readPixelOnDraw(
                            gameArea.width * x * canvasScaleX,
                            (gameArea.height * y) * canvasScaleY,
                        )
                        if (maxDelay <= 0) {
                            // =========== didn't see the required color => try to click again and wait one more time ==========
                            if (retries > 0) {
                                console.log("Colors didn't match after 10sec (retrying): ", pixel[0], pixel[1], pixel[2], "!=", color[0], color[1], color[2])
                                retries--
                                maxDelay = 10000
                                await runActions([prevClickAction])
                            } else {
                                console.log("Colors didn't match after 10sec (skipping): ", pixel[0], pixel[1], pixel[2], "!=", color[0], color[1], color[2])
                                break
                            }
                        }
                    } while (!colorsAreSame(pixel, color) && isRunningMacro)
                        await sleep(delay)
                } else if (actionType == actionChooseRoom) {
                    let leftPixel = await readPixelOnDraw(
                        gameArea.width * x * canvasScaleX,
                        gameArea.height * y * canvasScaleY,
                    )
                    let leftCategory = getColorCategory(leftPixel)
                    let leftColor = `rgb(${leftPixel[0]}, ${leftPixel[1]}, ${leftPixel[2]})`
                    let rightPixel = await readPixelOnDraw(
                        gameArea.width * altX * canvasScaleX,
                        gameArea.height * y * canvasScaleY,
                    )
                    let rightCategory = getColorCategory(rightPixel)
                    let rightColor = `rgb(${rightPixel[0]}, ${rightPixel[1]}, ${rightPixel[2]})`

                    const roomLeft = document.getElementById('roomLeft')
                    const roomRight = document.getElementById('roomRight')
                    const roomDecision = document.getElementById('roomDecision')
                    roomLeft.style.color = leftColor

                    roomRight.style.color = rightColor
                    roomLeft.textContent = getElementName(leftCategory)
                    roomRight.textContent = getElementName(rightCategory)

                    if (rightCategory >= leftCategory) {
                        skipActions = 1
                        roomDecision.textContent = "->"
                    } else {
                        roomDecision.textContent = "<-"
                    }
                } else if (actionType == actionClick) {
                    prevClickAction = action
                    await runUnityInput(target, x, y)
                    if (delay > 0) {
                        await sleep(delay)
                    }
                }
            }
        }

        async function runUnityInput(canvas, x, y) {
            const cx = gameArea.left + x * gameArea.width
            const cy = gameArea.top + y * gameArea.height

            function fireMouse(type, buttons = 0) {
                const e = new MouseEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: cx,
                    clientY: cy,
                    button: 0,
                    buttons
                })
                canvas.dispatchEvent(e)
            }

            function fireTouch(type) {
                const touch = {
                    identifier: Date.now(),
                    target: canvas,
                    clientX: cx,
                    clientY: cy,
                    pageX: cx,
                    pageY: cy,
                    screenX: cx,
                    screenY: cy
                }
                const e = new Event(type, {
                    bubbles: true,
                    cancelable: true
                })
                if (type !== 'touchend') {
                    e.touches = [touch]
                    e.targetTouches = [touch]
                } else {
                    e.touches = []
                    e.targetTouches = []
                }
                e.changedTouches = [touch]
                canvas.dispatchEvent(e)
            }

            fireMouse('mousedown', 1)
            fireTouch('touchstart')
            await sleep(30)
            fireMouse('mouseup', 0)
            fireMouse('click', 0)
            fireTouch('touchend')
        }

        async function logMouse(e) {
            const gameX = e.clientX - gameArea.x
            const gameY = e.clientY - gameArea.y

            await sleep(1000)

            const pixel = await readPixelOnDraw(gameX * canvasScaleX, gameY * canvasScaleY, 100)
            const r = pixel[0]
            const g = pixel[1]
            const b = pixel[2]
            const a = pixel[3]

            const clickObj = {
                x: gameX / gameArea.width,
                y: gameY / gameArea.height,
                color: [r,g,b],
                delay: 100,
                action: actionClick
            }

            console.log(JSON.stringify(clickObj))
            document.body.style.setProperty('--bg-color', `rgba(${r}, ${g}, ${b}, ${a / 255})`)
        }


        function storeInt(key, value) {
            localStorage.setItem(key, value)
        }

        function restoreInt(key, defaultValue = 0) {
            return Number(localStorage.getItem(key) || defaultValue)
        }

        let fromHomePage = false
        // Dungeon MACRO
        async function runDungeonMacro() {
            gameArea = gameCanvas.getBoundingClientRect()
            canvasScaleX = gameCanvas.width / gameArea.width
            canvasScaleY = gameCanvas.height / gameArea.height
            function delay(msec) {
                return{x: 2, y: 2, delay: msec, actionType: actionDelay}
            }
            function title(title) {
                return {actionType: actionTitle, title: title}
            }
            function getPointInRange(min, max, percent) {
                const t = percent / 100
                return min + (max - min) * t
            }

            if (isRunningMacro) {
                isRunningMacro = false
                setDungeonButtonState(false)
                releaseWakeLock()
                return
            } else {
                setDungeonButtonState(true)
                isRunningMacro = true
                enableWakeLock()
            }

            const floors = parseInt(document.getElementById('maxFloors').value, 10) || 1000
            const hpLimit = parseInt(document.getElementById('stopHPLimit').value, 10) || 0
            storeInt("maxFloors", floors)
            storeInt("stopHPLimit", hpLimit)
            const titansHpPoints = [[0.316481, 0.368048], [0.39636, 0.446916], [0.4752275, 0.527806], [0.555106, 0.608696], [0.634985, 0.688574]]

            let titansHP = [0,0,0,0,0]
            if (hpLimit < 100) {
                for (let i = 0; i<5; i++) {
                    titansHP[i] = getPointInRange(titansHpPoints[i][0], titansHpPoints[i][1], hpLimit)
                }
            }

            // ======= dungeon gates =======
            const waitForGateRight = {x :0.6703741152679474, y:0.11393805309734513, color: [29,37,83], delay: 100, actionType: actionWaitForColor, title: "waiting for right gate scene"}
            const gateRight = {x: 0.691268, y: 0.5, delay: 500, actionType: actionClick, title: "clicking on right gate"}

            const waitForGateMid = {x: 0.4752275025278059, y: 0.11172566371681415, color: [28,36,81], delay:100, actionType: actionWaitForColor, title: "waiting for mid gate scene"}
            const gateMid = {x: 0.500, y: 0.5, delay: 500, actionType: actionClick, title: "clicking on mid gate"}

            const waitForGateLeft = {x: 0.2901921132457027, y: 0.11172566371681415, color: [28,36,81], delay: 100, actionType: actionWaitForColor, title: "waiting for left gate scene"}
            const gateLeft = {x: 0.312, y: 0.5, delay: 500, actionType: actionClick, title: "clicking on left gate"}

            // ======= dungeon elemental rooms =======
            const waitFor1RoomSelection = {x: 0.69969666, y: 0.8506637, color: [17,12,6], delay: 100, actionType: actionWaitForColor, title: "waiting for single room selection popup"}
            const waitFor2RoomSelection = {x: 0.5, y: 0.5, color: [19,17,7], delay: 100, actionType: actionWaitForColor, title: "waiting for double room selection popup"}
            const roomMid = {x: 0.5, y: 0.795, delay: 500, actionType: actionClick, title: "clicking on mid room"}

            //  ======= usage: checkRoomColors, roomLeft, roomRight =======
            const checkRoomColors = {x: 0.31496881496881496, y: 0.6560364464692483, altX: 0.6891891891891891, delay: 100, actionType: actionChooseRoom, title: "choosing a correct room"}
            const roomLeft = {x: 0.3076, y: 0.8, delay: 500, actionType: actionClick, title: "clicking on left room"}
            const roomRight = {x: 0.6833, y: 0.8, delay: 500, actionType: actionClick, title: "clicking on right room"}
            // ======= dungeon battlefield screen =======

            const waitForBattlefield = {x: 0.014553, y: 0.952164, color: [34,46,64], delay: 100, actionType: actionWaitForColor, title: "waiting for battlefield scene"}
            const autoBattle = {x: 0.87214, y: 0.758542, delay: 500, actionType: actionClick, title: "clicking autobattle"}

            // ======= dungeon confirm auto-battle results screen =======
            const waitForConfirmBattle = {x: 0.60083, y: 0.127563, color: [137,1,0], delay:100, actionType: actionWaitForColor, title: "waiting for battle result popup"}

            let checkHP = title("check titans HP")

            if (titansHP[0] > 0) {
                checkHP = {x: 0, xx: titansHP, y: 0.461, color: [26,16,6], actionType: actionInterruptIfColor, title: "Check titans HP"}
            }

            const confirmBattle = {x: 0.641372, y: 0.822323, delay: 1000, actionType: actionClick, title: "clicking on confirm battle result"}

            // ======= dungeon floor finished symbol =======
            const waitForFloor1Done = {x: 0.3163664839467502, y: 0.1320754716981132, color: [18,21,26], delay: 100, actionType: actionWaitForColor, title: "waiting for floor1 final scene"}
            const floor1Done = {x: 0.7297, y: 0.47836, delay: 1000, actionType: actionClick, title: "clicking on floor1 final symbol"}

            const waitForFloor2Done = {x: 0.6985121378230227, y: 0.14408233276157806, color: [20,22,28], delay: 100, actionType: actionWaitForColor, title: "waiting for floor2 final scene"}
            const floor2Done = {x: 0.27755, y: 0.47836, delay: 1000, actionType: actionClick, title: "clicking on floor2 final symbol"}


            // ======= dungeon floor finished popup ========
            const waitForFloorConfirm = {x: 0.5, y: 0.5, color: [22,12,8], delay: 100, actionType: actionWaitForColor, title: "waiting for floor confirmation popup"}
            const floorConfirm = {x: 0.635, y: 0.697, delay: 4000, actionType: actionClick, title: "clicking on floor confirmation popup"}

            const jumpToRightGate = {x :0.6703741152679474, y:0.11393805309734513, color: [29,37,83], delay: 100, actionType: actionJump, title: "clicking on right gate"}
            const jumpToMidGate = {x: 0.4752275025278059, y: 0.11172566371681415, color: [28,36,81], delay: 100, actionType: actionJump, title: "clicking on mid gate"}
            const jumpToLeftGate = {x: 0.2901921132457027, y: 0.11172566371681415, color: [28,36,81], delay: 100, actionType: actionJump, title: "clicking on left gate"}
            const jumpToFloor1 = {x: 0.3163664839467502, y: 0.1320754716981132, color: [18,21,26], delay: 100, actionType: actionJump, title: "clicking on floor1 final symbol"}
            const jumpToFloor2 = {x: 0.6985121378230227, y: 0.14408233276157806, color: [20,22,28], delay: 100, actionType: actionJump, title: "clicking on floor2 final symbol"}
            //floor2 done -> finish

            if (fromHomePage) {
                fromHomePage = false
                await runActions([
                    {"delay": 10000, "action": actionDelay, title: "waiting until game is loaded"},
                    {"x": 0.488909426987061, "y":0.9969635627530364, "color":[56,37,2], "delay": 100, "action": actionWaitForColor, title: "checking if we are still on home screen"},
                    {"x": 0.5730129390018485, "y": 0.8937246963562753, "action": actionClick, delay: 1000, "title": "click on guild"},
                    {"x": 0.2412199630314233, "y": 0.4807692307692308, "action": actionClick, delay: 4000, "title": "click on dungeon"},
                ])
            }

            await runActions([
                jumpToRightGate, jumpToMidGate, jumpToLeftGate, jumpToFloor1, jumpToFloor2,
                gateRight, delay(1000), checkRoomColors, roomLeft, roomRight, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle, delay(3000),
                jumpToMidGate, jumpToFloor2,
                gateMid, delay(1000), checkRoomColors, roomLeft, roomRight, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle, delay(3000),
                jumpToMidGate, jumpToRightGate, jumpToLeftGate,
                gateMid, delay(1000), checkRoomColors, roomLeft, roomRight, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle, delay(3000),
                jumpToMidGate, jumpToRightGate, jumpToLeftGate,
                gateMid, delay(1000), checkRoomColors, roomLeft, roomRight, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle, delay(3000),
                jumpToLeftGate, jumpToRightGate,
                gateLeft, delay(1000), checkRoomColors, roomLeft, roomRight, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle, delay(3000),
                jumpToFloor1, jumpToMidGate,
                floor1Done, waitForFloorConfirm, floorConfirm, delay(5000),
                gateLeft, delay(1000), checkRoomColors, roomLeft, roomRight, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle, delay(3000),
                gateMid, delay(1000), checkRoomColors, roomLeft, roomRight, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle, delay(3000),
                jumpToMidGate, jumpToRightGate,
                gateMid, delay(1000), checkRoomColors, roomLeft, roomRight, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle, delay(3000),
                jumpToMidGate, jumpToRightGate,
                gateMid, delay(1000), checkRoomColors, roomLeft, roomRight, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle, delay(3000),
                gateRight, delay(1000), checkRoomColors, roomLeft, roomRight, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle, delay(3000),
                floor2Done, waitForFloorConfirm, floorConfirm, delay(5000),
            ], 1)

            for (let i = 0; i < floors; i++) {
                if (!isRunningMacro) return
                await runActions([
                    title("lvl1"), waitForGateRight, gateRight, waitFor1RoomSelection, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle,
                    title("lvl2"), waitForGateMid, gateMid, waitFor2RoomSelection, checkRoomColors, roomLeft, roomRight, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle,
                    title("lvl3"), waitForGateMid, gateMid, waitFor2RoomSelection, checkRoomColors, roomLeft, roomRight, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle,
                    title("lvl4"), waitForGateMid, gateMid, waitFor1RoomSelection, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle,
                    title("lvl5"), waitForGateLeft, gateLeft, waitFor2RoomSelection, checkRoomColors, roomLeft, roomRight, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle,
                    title("floor1"), waitForFloor1Done, floor1Done, waitForFloorConfirm, floorConfirm,
                    title("lvl6"), waitForGateLeft, gateLeft, waitFor1RoomSelection, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle,
                    title("lvl7"), waitForGateMid, gateMid, waitFor2RoomSelection, checkRoomColors, roomLeft, roomRight, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle,
                    title("lvl8"), waitForGateMid, gateMid, waitFor2RoomSelection, checkRoomColors, roomLeft, roomRight, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle,
                    title("lvl9"), waitForGateMid, gateMid, waitFor1RoomSelection, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle,
                    title("lvl0"), waitForGateRight, gateRight, waitFor2RoomSelection, checkRoomColors, roomLeft, roomRight, waitForBattlefield, autoBattle, waitForConfirmBattle, checkHP, confirmBattle,
                    title("floor2"), waitForFloor2Done, floor2Done, waitForFloorConfirm, floorConfirm,
                ])
            }
            isRunningMacro = false
            releaseWakeLock()
            setDungeonButtonState(false)
        }

        if (DEBUG_CLICKS) gameCanvas.addEventListener('click', logMouse)

        addNiceToolbar()

        fromHomePage = true
        await runDungeonMacro()
    }
})();
