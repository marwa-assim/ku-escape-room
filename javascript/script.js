const circles = document.querySelectorAll('.circle');
const moveCountDisplay = document.getElementById('move-count');
const resetButton = document.getElementById('reset-btn');
const continueButton = document.getElementById('continue-btn');
const answerButton = document.getElementById('answer-btn');

const answerConfirmOverlay = document.getElementById('answer-confirm-overlay');
const answerBlockOverlay = document.getElementById('answer-block-overlay');
const blockCountdownDisplay = document.getElementById('block-countdown');

const ingredientsNames = [
    'Strawberry', // index 0
    'Chocolate',      // index 1
    'Lemon',      // index 2
    'Honey',    // index 3
    'Sugar',      // index 4
    'Milk',       // index 5
    'Cherry',     // index 6
    'Mint',       // index 7
    'Orange'      // index 8
];

//const ANSWER_LOCK_SECONDS = 10; //60 seconds for testing only 

const ANSWER_LOCK_SECONDS = 5 * 60; // 5 minutes, in seconds
const REPEAT_ANSWER_COOLDOWN = 60;      // every answer reveal after that: 1 minute
let moveCount = 0;
let gameStarted = false;
let answerUnlocked = false;
let answerTimerInterval = null;

let gameWon = false;

function getNeighbors(index) {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const neighbors = [index]; // the circle itself always toggles too

    if (row > 0) neighbors.push(index - 3); // up
    if (row < 2) neighbors.push(index + 3); // down
    if (col > 0) neighbors.push(index - 1); // left
    if (col < 2) neighbors.push(index + 1); // right

    return neighbors;
}

function toggleCircle(index) {
    const neighborIndexes = getNeighbors(index);

    neighborIndexes.forEach((i) => {
        circles[i].classList.toggle('active');
    });
}

function checkWin() {
    const allActive = [...circles].every((circle) => circle.classList.contains('active'));

    if (allActive) {
        gameWon = true;

        const successMessage = document.getElementById('success-message');
        successMessage.classList.add('show');

        document.getElementById('continue-btn').classList.add('show');
    }
}

function resetPuzzle() {
    circles.forEach((circle) => {
        circle.classList.remove('active');
    });

    document.getElementById('success-message').classList.remove('show');
    document.getElementById('continue-btn').classList.remove('show');
    gameWon = false;

    clearInterval(answerTimerInterval);
    gameStarted = false;
    answerUnlocked = false;
    answerButton.disabled = true;
    updateAnswerButtonText(ANSWER_LOCK_SECONDS);

    answerConfirmOverlay.classList.remove('show');
    answerBlockOverlay.classList.remove('show')

    moveCount = 0;
    moveCountDisplay.textContent = moveCount;

    scrambleBoard();
}

function getRandomIndices(count) {
    const allIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8];

    // Shuffle the array (Fisher-Yates shuffle)
    for (let i = allIndices.length - 1; i > 0; i--) {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        [allIndices[i], allIndices[randomIndex]] = [allIndices[randomIndex], allIndices[i]];
    }

    return allIndices.slice(0, count);
}

function getHint() {
    const hintIndices = [];
    remainingSolution.forEach((needed, index) => {
        if (needed) hintIndices.push(index);
    });
    return hintIndices;
}

function formatAnswerText(indices) {
    const names = indices.map((index) => ingredientsNames[index]);
    const list = names.length <= 1
        ? names.join('')
        : names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];

    return `Press the '${list}' circles to solve the game`;
}

function updateAnswerButtonText(secondsLeft) {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    const paddedSeconds = seconds.toString().padStart(2, '0');
    answerButton.textContent = `Answer available in ${minutes}:${paddedSeconds}`;
}

/*
function startAnswerTimer() {
    let secondsLeft = ANSWER_LOCK_SECONDS;

    answerTimerInterval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft <= 0) {
            clearInterval(answerTimerInterval);
            answerUnlocked = true;
            answerButton.textContent = 'Get Answer';
            answerButton.disabled = false;
        } else {
            updateAnswerButtonText(secondsLeft);
        }
    }, 1000);
}
*/

function startAnswerCountdown(durationSeconds) {
    let secondsLeft = durationSeconds;
    answerUnlocked = false;
    answerButton.disabled = true;
    updateAnswerButtonText(secondsLeft);

    answerTimerInterval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft <= 0) {
            clearInterval(answerTimerInterval);
            answerUnlocked = true;
            answerButton.textContent = 'Get Answer';
            answerButton.disabled = false;
        } else {
            updateAnswerButtonText(secondsLeft);
        }
    }, 1000);
}

function showBlockOverlay(onComplete) {
    let secondsLeftToAnswer = 30;
    blockCountdownDisplay.textContent = secondsLeftToAnswer;
    answerBlockOverlay.classList.add('show');

    const blockInterval = setInterval(() => {
        secondsLeftToAnswer--;
        blockCountdownDisplay.textContent = secondsLeftToAnswer;
        if (secondsLeftToAnswer <= 0) {
            clearInterval(blockInterval);
            answerBlockOverlay.classList.remove('show');
            if (onComplete) onComplete();
        }
    }, 1000);
}

function sendAnswerToSupportScreen(text) {
    fetch('api/hint-api.php', {
        method: 'POST',
        body: new URLSearchParams({ action: 'send', hint_text: text }),
        cache: 'no-store'
    }).catch(() => {
        console.warn('Could not send the answer to the player screen.');
    });
}

function draftAnswerOnSupportScreen(text) {
    fetch('api/hint-api.php', {
        method: 'POST',
        body: new URLSearchParams({ action: 'draft', hint_text: text }),
        cache: 'no-store'
    }).catch(() => {
        console.warn('Could not preview the answer on the support screen.');
    });
}

answerButton.addEventListener('click', () => {
    if (!answerUnlocked || gameWon) return;

    draftAnswerOnSupportScreen(formatAnswerText(getHint()));
    answerConfirmOverlay.classList.add('show');
});

document.getElementById('use-answer-btn').addEventListener('click', () => {

    const readableAnswer = formatAnswerText(getHint());
    sendAnswerToSupportScreen(readableAnswer);

    sendAnswerToSupportScreen(formatAnswerText(getHint()));
    answerConfirmOverlay.classList.remove('show');

    showBlockOverlay(() => {
        startAnswerCountdown(REPEAT_ANSWER_COOLDOWN);
    });
});

document.getElementById('never-mind-btn').addEventListener('click', () => {
    draftAnswerOnSupportScreen(''); // clears the support screen's textbox
    answerConfirmOverlay.classList.remove('show');
});


circles.forEach((circle, index) => {
    circle.addEventListener('click', () => {
        if (gameWon) return; // ignore clicks once solved

        if (!gameStarted) {
            gameStarted = true;
            startAnswerCountdown(ANSWER_LOCK_SECONDS);
        }

        toggleCircle(index);
        moveCount++;
        moveCountDisplay.textContent = moveCount;

         remainingSolution[index] = !remainingSolution[index];

        checkWin();
    });
});

continueButton.addEventListener('click', () => {
    console.log('Continue clicked — this is where the themed recipe page will load.');
    // TODO: replace this with the actual transition to the themed secret-recipe page
});

resetButton.addEventListener('click', resetPuzzle);

let solutionMoves = [];
let remainingSolution = [];

function scrambleBoard() {
    circles.forEach((circle) => {
        circle.classList.add('active'); // force true solved state first
    });

    solutionMoves = getRandomIndices(5);
    solutionMoves.forEach((index) => {
        toggleCircle(index);
    });

    // Track remaining solution as a true/false flag per button
    remainingSolution = Array(9).fill(false);
    solutionMoves.forEach((index) => {
        remainingSolution[index] = true;
    });

    console.log('Solution (any order):', solutionMoves);
}

scrambleBoard();
updateAnswerButtonText(ANSWER_LOCK_SECONDS);
