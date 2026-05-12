/// VERSION 1.0.3
/// MACRO RUNNER - PASTE THIS CODE IN CONSOLE ONLY ONCE
/// Send your ideas for improvements to Deidara/Phoenix Rebirth at Discord: @int021h
const DEBUG_CLICKS = false

const gameArea = gameCanvas.getBoundingClientRect()
const canvasScaleX = gameCanvas.width / gameArea.width
const canvasScaleY = gameCanvas.height / gameArea.height

// MACRO stuff
const actionClick = 1
const actionDelay = 2
const actionChooseRoom = 3
const actionTitle = 4
const actionWaitForColor = 5

var isRunningMacro = false
var lvlTitle = ""


// Pixel color picker
const colorsMatchThreshold = 15
const gl = gameCanvas.getContext('webgl2')
const originalRAF = window.requestAnimationFrame
let pendingRead = null
const pixels = new Uint8Array(4)
var readPixelsOnce = 0
var readX = 0
var readY = 0


window.requestAnimationFrame = function(callback) {
    return originalRAF.call(window, onFrame)
    function onFrame(time) {
        callback(time)
        if (!pendingRead) return
        gl.readPixels(
            pendingRead.x,
            gl.canvas.height - pendingRead.y,
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixels
        )
        pendingRead.resolve(new Uint8Array(pixels))
        pendingRead = null
    }
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
    if (r > 200 && r < 240 && g > 200 && b < 100) {
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

function addDebugToolbar() {
    const container = document.createElement('span')

    const button = document.createElement('button')
    button.id = 'dungeonMacroButton'
    button.textContent = 'Run Dungeon'
    button.addEventListener('click', runDungeonMacro)

    const roomLeft = document.createElement('span')
    roomLeft.id = 'roomLeft'
    roomLeft.textContent = 'LEFT'

    const roomDecision = document.createElement('span')
    roomDecision.id = 'roomDecision'
    roomDecision.textContent = ' ? '
    
    const roomRight = document.createElement('span')
    roomRight.id = 'roomRight'
    roomRight.textContent = 'RIGHT'

    container.appendChild(button)
    container.appendChild(document.createTextNode(' '))
    container.appendChild(roomLeft)
    container.appendChild(document.createTextNode(' '))
    container.appendChild(roomDecision)
    container.appendChild(document.createTextNode(' '))
    container.appendChild(roomRight)
    header.insertBefore(container, header.children[1])
}

/// MACRO RUNNER
async function runActions(actions) {
    const target = gameCanvas

    const sleep = ms => new Promise(r => setTimeout(r, ms))
    var skipActions = 0
    var prevClickAction = actions[0]
    for (const action of actions) {
        if (!isRunningMacro) return
        
        if (skipActions > 0) {
            skipActions--
            console.log("Skipping left room: ", JSON.stringify(action))
            continue
        }
        console.log(JSON.stringify(action))
        const {
            x = 0,
            y = 0,
            color = [],
            altX = 0,
            delay = 0,
            title = "",
            actionType = actionClick
        } = action

        if (actionType == actionTitle) {
            lvlTitle = title
            continue
        }

        if (title != "") {
            document.title = lvlTitle + ": " + title
        }

        if (actionType == actionDelay) {
            if (delay > 0) {
                await sleep(delay)
            }
        } else if (actionType == actionWaitForColor) {
            var retries = 1
            var maxDelay = 10000
            var testPixel = []
            do {
                await sleep(delay)
                maxDelay -= delay
        
                testPixel = await readPixelOnDraw(
                    gameArea.width * x * canvasScaleX,
                    (gameArea.height * y) * canvasScaleY,
                )
                if (maxDelay <= 0) {
                    // =========== didn't see the required color => try to click again and wait one more time ==========
                    if (retries > 0) {
                         console.log("Colors didn't match after 10secs (retrying): ", testPixel[0], testPixel[1], testPixel[2], "!=", color[0], color[1], color[2])
                         retries--
                         maxDelay = 10000
                         await runActions([prevClickAction])
                    } else {
                         console.log("Colors didn't match after 10secs (skipping check): ", testPixel[0], testPixel[1], testPixel[2], "!=", color[0], color[1], color[2])
                         break
                    }
                }
            } while (!colorsAreSame(testPixel, color, colorsMatchThreshold) && isRunningMacro)
            await sleep(delay)
        } else if (actionType == actionChooseRoom) {
            var leftPixel = await readPixelOnDraw(
                gameArea.width * x * canvasScaleX,
                gameArea.height * y * canvasScaleY,
            )
            var leftCategory = getColorCategory(leftPixel)
            var leftColor = `rgb(${leftPixel[0]}, ${leftPixel[1]}, ${leftPixel[2]})`

            var rightPixel = await readPixelOnDraw(
                gameArea.width * altX * canvasScaleX,
                gameArea.height * y * canvasScaleY,
            )
            var rightCategory = getColorCategory(rightPixel)
            var rightColor = `rgb(${rightPixel[0]}, ${rightPixel[1]}, ${rightPixel[2]})`

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
            target.focus()
            prevClickAction = action
            const touch = new Touch({
                identifier: Date.now(),
                target,
                clientX: gameArea.x + gameArea.width * x,
                clientY: gameArea.y + gameArea.height * y,
                radiusX: 2,
                radiusY: 2,
                rotationAngle: 0,
                force: 1
            })

            const touchStart = new TouchEvent('touchstart', {
                bubbles: true,
                cancelable: true,
                touches: [touch],
                targetTouches: [touch],
                changedTouches: [touch]
            })

            const touchEnd = new TouchEvent('touchend', {
                bubbles: true,
                cancelable: true,
                touches: [],
                targetTouches: [],
                changedTouches: [touch]
            })

            target.dispatchEvent(touchStart)
            await sleep(50)
            target.dispatchEvent(touchEnd)
            if (delay > 0) {
                await sleep(delay)
            }
        }
    }
}

async function logMouse(e) {
    const gameX = e.clientX - gameArea.x
    const gameY = e.clientY - gameArea.y

    const sleep = ms => new Promise(r => setTimeout(r, ms))
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
if (DEBUG_CLICKS) gameCanvas.addEventListener('click', logMouse)

// Dungeon MACRO
async function runDungeonMacro() {
    function title(title) {
       return {actionType: actionTitle, title: title}
    }

    if (isRunningMacro) {
        isRunningMacro = false
        dungeonMacroButton.textContent = "Run Dungeon"
        releaseWakeLock()
        return 
    } else {
        dungeonMacroButton.textContent = "Stop Dungeon"
        isRunningMacro = true
        enableWakeLock()
    }

    
    const someDelay = { 
        x: 2, 
        y: 2, 
        delay: 2000, 
        actionType: actionDelay
    }

    // ======= dungeon gates ======= 
    const waitForGateRight = {
        x: 0.8378378378378378,
        y: 0.21184510250569477,
        color: [49,49,65], 
        delay: 100, 
        actionType: actionWaitForColor, 
        title: "waiting for right gate scene"
    }
    const waitForGate10 = {
        x: 0.3492723492723493, 
        y:0.30068337129840544, 
        color: [48,54,60], 
        delay: 100, 
        actionType: actionWaitForColor, 
        title: "waiting for floor2 gate10 scene"
    }
    const gateRight = {
        x:0.691268,
        y:0.5, 
        delay: 500, 
        actionType: actionClick, 
        title: "clicking on right gate"
    }

    const waitForGateMid = {
        x: 0.6424116424116424, 
        y: 0.21184510250569477, 
        color: [49,49,65], 
        delay:100, 
        actionType: actionWaitForColor, 
        title: "waiting for mid gate scene"
    }
    const gateMid = {
        x: 0.500, 
        y: 0.5, 
        delay: 500, 
        actionType: actionClick, 
        title: "clicking on mid gate"
    }

    const waitForGateLeft = {
        x: 0.16112266112266113, 
        y: 0.21184510250569477, 
        color: [49,49,65], 
        delay: 100, 
        actionType: actionWaitForColor, 
        title: "waiting for left gate scene"
    }
    const gateLeft = {
        x: 0.312, 
        y: 0.5, 
        delay: 500, 
        actionType: actionClick, 
        title: "clicking on left gate"
    }

    // ======= dungeon elemental rooms ======= 
    const waitFor1RoomSelection = {
        x: 0.69969666, 
        y: 0.8506637,
        color: [17,12,6], 
        delay: 100, 
        actionType: actionWaitForColor, 
        title: "waiting for single room selection popup"
    }
    const waitFor2RoomSelection = {
        x: 0.5, 
        y: 0.5, 
        color: [19,17,7], 
        delay: 100, 
        actionType: actionWaitForColor, 
        title: "waiting for double room selection popup"
    }
    const roomMid = {
        x: 0.5, 
        y: 0.795, 
        delay: 500, 
        actionType: actionClick, 
        title: "clicking on mid room"
    }

    //  ======= usage: checkRoomColors, roomLeft, roomRight ======= 
    const checkRoomColors = {
        x: 0.31496881496881496, 
        y: 0.6560364464692483,
        altX: 0.6891891891891891,
        delay: 100, 
        actionType: actionChooseRoom, 
        title: "choosing a correct room"
    }
    const roomLeft = {
        x: 0.3076, 
        y: 0.8,
        delay: 500, 
        actionType: actionClick,
        title: "clicking on left room"
    }
    const roomRight = {
        x: 0.6833, 
        y: 0.8, 
        delay: 500, 
        actionType: actionClick,
        title: "clicking on right room"
    }
    // ======= dungeon battlefield screen ======= 

    const waitForBattlefield = {
        x: 0.014553, 
        y: 0.952164, 
        color: [34,46,64], 
        delay: 100, 
        actionType: actionWaitForColor, 
        title: "waiting for battlefield scene"
    }
    const autoBattle = {
        x: 0.87214, 
        y: 0.758542, 
        delay: 500, 
        actionType: actionClick, 
        title: "clicking autobattle"
    }

    // ======= dungeon confirm auto-battle results screen ======= 
    const waitForConfirmBattle = {
        x: 0.60083, 
        y: 0.127563, 
        color: [137,1,0], 
        delay:100, 
        actionType: actionWaitForColor, 
        title: "waiting for battle result popup"
    }
    const confirmBattle = {
        x: 0.641372, 
        y: 0.822323, 
        delay: 1000, 
        actionType: actionClick, 
        title: "clicking on confirm battle result"
    }

    // ======= dungeon floor finished symbol ======= 
    const waitForFloor1Done = {
        x:0.6496881496881497, 
        y:0.30068337129840544, 
        color: [51,54,60], 
        delay: 100, 
        actionType: actionWaitForColor,
        title: "waiting for floor1 final scene"
    }
    const floor1Done = {
        x: 0.7297, 
        y: 0.47836, 
        delay: 1000, 
        actionType: actionClick, 
        title: "clicking on floor1 final symbol"
    }

    const waitForFloor2Done = {
        x: 0.3492723492723493, 
        y: 0.30068337129840544, 
        color: [48,54,60], 
        delay: 100, 
        actionType: actionWaitForColor, 
        title: "waiting for floor2 final scene"
    }
    const floor2Done = {
        x: 0.27755, 
        y: 0.47836, 
        delay: 1000, 
        actionType: actionClick, 
        title: "clicking on floor2 final symbol"
    }
    // ======= dungeon floor finished popup ========

    const waitForFloorConfirm = {
        x: 0.5, 
        y: 0.5, 
        color: [22,12,8], 
        delay: 100, 
        actionType: actionWaitForColor,  
        title: "waiting for floor confirmation popup"
    }
    const floorConfirm = {
        x: 0.635, 
        y: 0.697, 
        delay: 4000, 
        actionType: actionClick, 
        title: "clicking on floor confirmation popup"
    }
    const floors = 200

    for (let i = 0; i < floors; i++) {
        if (!isRunningMacro) return
        await runActions([
            someDelay, 
            title("lvl1 single"), waitForGateRight, gateRight, waitFor1RoomSelection, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, confirmBattle,
            title("lvl2 double"), waitForGateMid, gateMid, waitFor2RoomSelection, checkRoomColors, roomLeft, roomRight, waitForBattlefield, autoBattle, waitForConfirmBattle, confirmBattle,
            title("lvl3 double"), waitForGateMid, gateMid, waitFor2RoomSelection, checkRoomColors, roomLeft, roomRight, waitForBattlefield, autoBattle, waitForConfirmBattle, confirmBattle,
            title("lvl4 single"), waitForGateMid, gateMid, waitFor1RoomSelection, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, confirmBattle,
            title("lvl5 double"), waitForGateLeft, gateLeft, waitFor2RoomSelection, checkRoomColors, roomLeft, roomRight, waitForBattlefield, autoBattle, waitForConfirmBattle, confirmBattle,
            title("floor1 done"), waitForFloor1Done, floor1Done, waitForFloorConfirm, floorConfirm, 
            title("lvl6 single"), waitForGateLeft, gateLeft, waitFor1RoomSelection, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, confirmBattle, 
            title("lvl7 double"), waitForGateMid, gateMid, waitFor2RoomSelection, checkRoomColors, roomLeft, roomRight, waitForBattlefield, autoBattle, waitForConfirmBattle, confirmBattle, 
            title("lvl8 double"), waitForGateMid, gateMid, waitFor2RoomSelection, checkRoomColors, roomLeft, roomRight, waitForBattlefield, autoBattle, waitForConfirmBattle, confirmBattle, 
            title("lvl9 single"), waitForGateMid, gateMid, waitFor1RoomSelection, roomMid, waitForBattlefield, autoBattle, waitForConfirmBattle, confirmBattle, 
            title("lvl0 double"), waitForGate10, gateRight, waitFor2RoomSelection, checkRoomColors, roomLeft, roomRight, waitForBattlefield, autoBattle, waitForConfirmBattle, confirmBattle,
            title("floor2 done"), waitForFloor2Done, floor2Done, waitForFloorConfirm, floorConfirm,
        ])
    }
    isRunningMacro = false
    releaseWakeLock()
    dungeonMacroButton.textContent = "Run Dungeon"
}

if (!document.getElementById('roomLeft')) {
    addDebugToolbar()
}

