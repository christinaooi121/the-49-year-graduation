// --- 全局變數 ---
let gameData = {};
let currentScene = null
let attributes = { idealism: 0, alienation: 0 };
let dialogueQueue = []; 

// 讀取結局紀錄
let unlockedEndings = JSON.parse(localStorage.getItem('fred_endings')) || {
    1: false, 2: false, 3: false, 4: false
};

let typewriter = {
    fullText: "", timer: null, index: 0, speed: 50, isTyping: false
};

const SPEED_NORMAL = 50;   
const SPEED_SYSTEM = 70;   
const SPEED_CHAPTER = 150; 

// --- 1. 初始化 ---
async function initGame() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error("無法讀取 data.json");
        gameData = await response.json();
        /* Cover */
        renderScene("Cover"); 
    } catch (error) {
        console.error(error);
        document.getElementById('dialogue-text').innerText = "讀取失敗";
    }
}

// --- 2. 渲染場景 (含標題模式) ---
function renderScene(sceneId) {
    console.log("正在進入場景:", sceneId);

    // A. 數值重置
    if (sceneId === "Chapter_00_Title" || sceneId === "Chapter_01_Title" || sceneId === "Event_01") {
        attributes = { idealism: 0, alienation: 0 };
    }

    // B. 結局解鎖檢查
    checkUnlockEnding(sceneId);
    hideToast();

    // C. 載入資料
    currentScene = gameData.scenes.find(s => s.scene_id === sceneId);
    if (!currentScene) {
        console.error("找不到場景:", sceneId);
        return;
    }

    // D. 視覺與容器設定
    updateVisuals(currentScene);
    const gameContainer = document.getElementById('game-container');
    
    // 1. 純畫面模式 (hide-ui)
    if (currentScene.hide_ui || currentScene['hide-ui']) {
        gameContainer.classList.add('hide-ui');
    } else {
        gameContainer.classList.remove('hide-ui');
    }

    // 2. 畫廊模式標籤
    if (sceneId === "Gallery_View") {
        gameContainer.classList.add('gallery-active');
    } else {
        gameContainer.classList.remove('gallery-active');
    }

    // 3. 【新增】標題模式標籤 (Title Mode)
    // 只要 JSON 裡有 "is_title": true，就啟動這個模式
    if (currentScene.is_title) {
        gameContainer.classList.add('title-mode');
    } else {
        gameContainer.classList.remove('title-mode');
    }

    // E. 樣式與狀態更新
    updateDialogueStyleAndSpeed(currentScene);
    updateStatsUI();

    // 畫廊攔截
    if (sceneId === "Gallery_View") {
        renderGalleryContent();
        setupInteraction(currentScene.choices);
        const dialogueBox = document.getElementById('dialogue-box');
        dialogueBox.classList.remove('clickable');
        dialogueBox.onclick = null; 
        return; 
    }

    // F. 文字處理邏輯
    if (currentScene.text && currentScene.text.trim() !== "") {
        dialogueQueue = currentScene.text.split(/\n\s*\n/);
    } else {
        dialogueQueue = [];
    }

    playNextDialogueChunk();
}

// --- 3. 畫廊繪製邏輯 ---
function renderGalleryContent() {
    const textBox = document.getElementById('dialogue-text');
    const dialogueBox = document.getElementById('dialogue-box');
    
    // 強制再次加上樣式，確保不被覆蓋
    dialogueBox.classList.add('style-gallery');
    
    const endingInfo = [
        { id: 1, title: "玉石俱焚", icon: "💥" },
        { id: 2, title: "無根的漂泊", icon: "🌊" },
        { id: 3, title: "沈默的傷痕", icon: "🤐" },
        { id: 4, title: "真實的力量", icon: "🎤" }
    ];

    let html = `<div style="text-align:center; font-weight:bold; margin-bottom:10px; color:#f0c040;">【結局蒐集進度】</div>`;
    html += `<div class="gallery-grid">`;

    endingInfo.forEach(end => {
        const isUnlocked = unlockedEndings[end.id];
        const statusClass = isUnlocked ? "unlocked" : "locked";
        const titleText = isUnlocked ? end.title : "???";
        const iconDisplay = isUnlocked ? end.icon : "🔒";

        html += `
            <div class="end-card ${statusClass}">
                <div class="icon">${iconDisplay}</div>
                <div class="title">End ${end.id}<br>${titleText}</div>
            </div>
        `;
    });

    html += `</div>`;
    
    // 直接寫入 HTML，不使用打字機
    textBox.innerHTML = html;
    textBox.classList.remove('typing-cursor');
    
    // 確保文字框可以顯示且不被隱藏
    textBox.style.display = "block";
    textBox.style.opacity = "1";
}

function checkUnlockEnding(sceneId) {
    let endingUnlocked = 0;
    if (sceneId === "Ending_01_Revenge_End") endingUnlocked = 1;
    else if (sceneId === "Ending_02_Escape_End") endingUnlocked = 2;
    else if (sceneId === "Ending_03_Silent_End") endingUnlocked = 3;
    else if (sceneId === "Ending_04_True_End") endingUnlocked = 4;

    if (endingUnlocked > 0 && !unlockedEndings[endingUnlocked]) {
        unlockedEndings[endingUnlocked] = true;
        localStorage.setItem('fred_endings', JSON.stringify(unlockedEndings));
        showToast(`已解鎖結局 ${endingUnlocked}/4`);
    }
}

function playNextDialogueChunk() {
    const dialogueBox = document.getElementById('dialogue-box');
    const nextIndicator = document.querySelector('.next-indicator');
    const overlay = document.getElementById('choices-overlay');

    overlay.classList.remove('active');
    nextIndicator.style.display = 'none';
    dialogueBox.classList.remove('clickable');
    dialogueBox.onclick = null; 

    if (dialogueQueue.length > 0) {
        const textChunk = dialogueQueue.shift(); 
        startTypewriter(textChunk, () => {
            if (dialogueQueue.length > 0) setupClickToNextChunk();
            else setupInteraction(currentScene.choices);
        });
    } else {
        setupInteraction(currentScene.choices);
    }
}

function setupClickToNextChunk() {
    const dialogueBox = document.getElementById('dialogue-box');
    const nextIndicator = document.querySelector('.next-indicator');
    if (!dialogueBox.classList.contains('style-chapter')) nextIndicator.style.display = 'block';
    dialogueBox.classList.add('clickable');
    dialogueBox.onclick = () => { playNextDialogueChunk(); };
}

function startTypewriter(text, onComplete) {
    const textBox = document.getElementById('dialogue-text');
    const dialogueBox = document.getElementById('dialogue-box');
    
    typewriter.fullText = text;
    typewriter.index = 0;
    typewriter.isTyping = true;
    textBox.innerHTML = ""; 
    textBox.classList.add('typing-cursor');

    if (typewriter.timer) clearInterval(typewriter.timer);

    dialogueBox.onclick = () => {
        if (typewriter.isTyping) finishTypingImmediately(onComplete);
    };
    dialogueBox.classList.add('clickable');

    typewriter.timer = setInterval(() => {
        if (typewriter.index < typewriter.fullText.length) {
            textBox.textContent += typewriter.fullText.charAt(typewriter.index);
            typewriter.index++;
            textBox.scrollTop = textBox.scrollHeight;
        } else {
            finishTypingImmediately(onComplete);
        }
    }, typewriter.speed); 
}

function finishTypingImmediately(onComplete) {
    clearInterval(typewriter.timer);
    const textBox = document.getElementById('dialogue-text');
    textBox.textContent = typewriter.fullText;
    textBox.classList.remove('typing-cursor');
    typewriter.isTyping = false;
    document.getElementById('dialogue-box').onclick = null;
    if (onComplete) onComplete();
}

// --- 6. 選項互動邏輯 (封面單擊版) ---
function setupInteraction(choices) {
    const dialogueBox = document.getElementById('dialogue-box');
    const nextIndicator = document.querySelector('.next-indicator');
    const overlay = document.getElementById('choices-overlay');
    const gameContainer = document.getElementById('game-container');

    // 重置介面
    overlay.innerHTML = '';
    overlay.classList.remove('active'); 
    nextIndicator.style.display = 'none';
    
    // 先移除所有點擊，避免誤觸
    dialogueBox.classList.remove('clickable');
    dialogueBox.onclick = null;
    dialogueBox.ondblclick = null; 

    const isHiddenUI = gameContainer.classList.contains('hide-ui');
    const isGallery = dialogueBox.classList.contains('style-gallery');
    const isTitle = gameContainer.classList.contains('title-mode');

    // --- 優先級 1: 標題模式 (Title Mode) ---
    // 需求：全螢幕封面，點擊任意處一次，直接開始
    if (isTitle) {
        // 加入 200ms 延遲，防止玩家在上一個畫面連點導致誤觸
        setTimeout(() => {
            dialogueBox.classList.add('clickable');
            dialogueBox.onclick = () => {
                if (choices && choices.length > 0) {
                    executeChoice(choices[0]);
                }
            };
        }, 200);
        return; 
    }
    
    // --- 優先級 2: 純畫面模式 (Hide UI) ---
    if (isHiddenUI) {
        setTimeout(() => {
            dialogueBox.classList.add('clickable');
            dialogueBox.onclick = () => {
                if (choices && choices.length > 0) {
                    executeChoice(choices[0]);
                }
            };
        }, 200); 
        return; 
    }

    // --- 定義：顯示按鈕的函式 ---
    const showButtons = () => {
        dialogueBox.classList.remove('clickable');
        dialogueBox.onclick = null;
        nextIndicator.style.display = 'none';

        choices.forEach(choice => {
            const btn = document.createElement('div');
            btn.className = 'choice-btn';
            
            const isLocked = !checkCondition(choice.condition);
            
            if (isLocked) {
                btn.classList.add('locked');
                btn.innerHTML = `🔒 ${choice.text}`; 
                btn.onclick = (e) => { 
                    e.stopPropagation(); 
                    showToast(choice.hint || "條件未達成"); 
                };
            } else {
                btn.innerText = choice.text;
                btn.onclick = (e) => { 
                    e.stopPropagation(); 
                    executeChoice(choice); 
                };
            }
            
            overlay.appendChild(btn);
        });
        
        overlay.classList.add('active');
    };

    // --- 優先級 3: 畫廊模式 ---
    if (isGallery) {
        showButtons();
        return;
    }

    // --- 優先級 4: 一般劇情模式 ---
    const isSingleEllipsis = (choices && choices.length === 1 && choices[0].text === "...");

    if (!dialogueBox.classList.contains('style-chapter')) {
        nextIndicator.style.display = 'block';
    }
    
    setTimeout(() => {
        dialogueBox.classList.add('clickable');
        dialogueBox.onclick = () => {
            if (choices && choices.length > 0) {
                if (isSingleEllipsis) {
                    executeChoice(choices[0]);
                } else {
                    showButtons();
                }
            } else {
                 console.log("無選項 (End)");
            }
        };
    }, 50);
}
function checkCondition(conditionStr) {
    if (!conditionStr) return true; 
    try {
        const checkFunc = new Function('idealism', 'alienation', `return ${conditionStr};`);
        return checkFunc(attributes.idealism, attributes.alienation);
    } catch (e) {
        console.error("條件解析錯誤:", conditionStr, e); return false; 
    }
}

let toastTimer = null;
function showToast(message) {
    const toast = document.getElementById('toast-msg');
    toast.innerText = message; toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { hideToast(); }, 3000);
}

function hideToast() {
    const toast = document.getElementById('toast-msg');
    if (toast) toast.classList.remove('show');
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
}

function executeChoice(choice) {
    // 1. 處理數值變化
    if (choice.attribute_changes) {
        attributes.idealism += (choice.attribute_changes.idealism || 0);
        attributes.alienation += (choice.attribute_changes.alienation || 0);
    }

    // 2. 檢查 next_scene_id 是否存在
    if (choice.next_scene_id) {
        // 【新增功能】檢查是否為外部連結 (http 開頭)
        if (choice.next_scene_id.startsWith('http')) {
            // 使用 window.open 開啟新分頁，避免玩家跳出遊戲
            window.open(choice.next_scene_id, '_blank');
        } 
        // 否則，視為內部場景 ID，進行遊戲跳轉
        else {
            renderScene(choice.next_scene_id);
        }
    }
}
function updateVisuals(scene) {
    const bgImg = document.getElementById('bg-img');
    const charImg = document.getElementById('char-img');
    if (scene.bg_img) bgImg.src = scene.bg_img;
    if (scene.char_img && scene.char_img.trim() !== "") {
        charImg.src = scene.char_img; charImg.style.opacity = 1;
    } else {
        charImg.style.opacity = 0; charImg.removeAttribute('src');
    }
}

function updateDialogueStyleAndSpeed(scene) {
    const dialogueBox = document.getElementById('dialogue-box');
    const nameTag = document.getElementById('name-tag');
    const speaker = scene.speaker || "";

    dialogueBox.classList.remove('style-system', 'with-icon', 'style-thought', 'style-chapter', 'style-gallery');
    void dialogueBox.offsetWidth; 

    if (speaker === "【章節】") {
        dialogueBox.classList.add('style-chapter');
        nameTag.style.display = 'none';
        typewriter.speed = SPEED_CHAPTER;
    } 
    else if (speaker === "【系統】") {
        dialogueBox.classList.add('style-system');
        nameTag.style.display = 'none';
        typewriter.speed = SPEED_SYSTEM;
    }
    else if (speaker === "【系統警示】") {
        dialogueBox.classList.add('style-system', 'with-icon');
        nameTag.style.display = 'none';
        typewriter.speed = SPEED_SYSTEM;
    }
    else if (speaker.includes("內心") || speaker.includes("獨白")) {
        dialogueBox.classList.add('style-thought');
        nameTag.innerText = speaker;
        nameTag.style.display = 'block';
        typewriter.speed = SPEED_NORMAL;
    } 
    else if (speaker !== "") {
        nameTag.innerText = speaker;
        nameTag.style.display = 'block';
        typewriter.speed = SPEED_NORMAL;
    } 
    else {
        nameTag.style.display = 'none';
        typewriter.speed = SPEED_NORMAL;
    }
}

function updateStatsUI() {
    const elIdeal = document.getElementById('val-idealism');
    const elAlien = document.getElementById('val-alienation');
    if(elIdeal) elIdeal.innerText = attributes.idealism;
    if(elAlien) elAlien.innerText = attributes.alienation;
}

initGame();