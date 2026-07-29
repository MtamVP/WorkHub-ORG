document.addEventListener('DOMContentLoaded', () => {
    const room = document.getElementById('lounge-room');
    const myPlayer = document.getElementById('my-player');
    const colorPicker = document.getElementById('color-picker');
    const myBody = document.getElementById('my-body-color');
    const myBackpack = document.querySelector('.backpack');
    
    const nameText = document.querySelector('.player-name');
    const statusDot = document.querySelector('.status-dot');
    const radarList = document.getElementById('radar-list');
    const playerCount = document.getElementById('player-count');

    const btnBackToWork = document.getElementById('btn-back-to-work');
    const warpFlash = document.getElementById('warp-flash');
    const topBar = document.querySelector('.hud-top-bar');
    const uiPanel = document.getElementById('ui-panel');
    const multiplayerPanel = document.getElementById('multiplayer-panel');

    const myEmail = localStorage.getItem('userEmail') || 'guest@workhub.com';
    let myName = localStorage.getItem('userName');
    if (!myName) {
        myName = myEmail.split('@')[0];
    }
    const myGroup = localStorage.getItem('userGroup') || 'all'; 
    
    let currentX = window.innerWidth / 2;
    let currentY = window.innerHeight * 0.7; 

    const currentStatus = localStorage.getItem('my_status') || 'in-lounge';
    
    if (currentStatus === 'idle') {
        nameText.innerText = `${myName} (Zzz...)`;
        statusDot.className = "status-dot idle";
        
        const wakeUp = () => {
            const returnUrl = localStorage.getItem('return_url') || '/dashboard/';
            localStorage.setItem('my_status', 'active');
            window.location.href = returnUrl; 
        };

        setTimeout(() => {
            ['mousemove', 'keydown', 'click'].forEach(evt => {
                document.addEventListener(evt, wakeUp, {once: true});
            });
        }, 1000);

    } else {
        nameText.innerText = `${myName} (In Lounge)`;
        statusDot.className = "status-dot in-lounge";

        room.addEventListener('click', (e) => {
            currentX = e.clientX;
            currentY = e.clientY;

            myPlayer.style.left = currentX + 'px';
            myPlayer.style.top = currentY + 'px';

            const currentLeft = myPlayer.offsetLeft;
            if (currentX < currentLeft) {
                myPlayer.style.transform = "translate(-50%, -100%) scaleX(-1)"; 
            } else {
                myPlayer.style.transform = "translate(-50%, -100%) scaleX(1)";  
            }
        });
    }

    colorPicker.addEventListener('input', (e) => {
        const newColor = e.target.value;
        myBody.style.backgroundColor = newColor;
        myBackpack.style.backgroundColor = newColor;
        localStorage.setItem('my_color', newColor); 
    });

    let savedColor = localStorage.getItem('my_color');
    
    if (!savedColor) {
        const palette = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f1c40f', '#e67e22', '#1abc9c', '#ff9ff3', '#0abde3', '#c8d6e5'];
        savedColor = palette[Math.floor(Math.random() * palette.length)];
        localStorage.setItem('my_color', savedColor);
    }

    colorPicker.value = savedColor;
    myBody.style.backgroundColor = savedColor;
    myBackpack.style.backgroundColor = savedColor;

    async function syncMultiplayer() {
        const color = colorPicker.value;
        const status = localStorage.getItem('my_status') || 'in-lounge';

        const payload = {
            email: myEmail,
            name: myName,
            group: myGroup,
            status: status,
            color: color,
            x: currentX,
            y: currentY
        };

        try {
            if (typeof callGAS === 'function') {
                const res = await callGAS('syncLounge', payload);
                if (res.status === 'success') {
                    renderOtherPlayers(res.data);
                }
            } else {
                console.warn("Chưa tải được file api.js để gọi server");
            }
        } catch (error) {
            console.error("Lỗi đồng bộ phòng chờ:", error);
        }
    }

    function renderOtherPlayers(players) {
        if (playerCount) playerCount.innerText = players.length + " Online";

        let radarHTML = `
            <div class="d-flex align-items-center mb-2 text-light p-2 rounded" style="background: rgba(255,255,255,0.1); border-left: 3px solid ${colorPicker.value};">
                <span class="status-dot in-lounge me-2" style="box-shadow: 0 0 5px #9b59b6; background-color: #9b59b6;"></span> 
                <span class="fw-bold">${myName}</span>
                <span class="ms-auto text-info small fw-bold">[Local]</span>
            </div>
        `;

        players.forEach(p => {
            if (p.email === myEmail) return;

            const safeId = "player-" + p.email.replace(/[@.]/g, '-');
            let playerEl = document.getElementById(safeId);

            if (!playerEl) {
                playerEl = document.createElement('div');
                playerEl.id = safeId;
                playerEl.className = 'player other-player';
                
                playerEl.innerHTML = `
                    <div class="nameplate">
                        <span class="status-dot"></span>
                        <span class="player-name"></span>
                    </div>
                    <div class="crewmate">
                        <div class="backpack"></div>
                        <div class="body"><div class="visor"></div></div>
                    </div>
                `;
                room.appendChild(playerEl);
            }

            const oldLeft = parseInt(playerEl.style.left) || p.x;
            playerEl.style.left = p.x + 'px';
            playerEl.style.top = p.y + 'px';

            if (p.x < oldLeft) {
                playerEl.style.transform = "translate(-50%, -100%) scaleX(-1)"; 
            } else {
                playerEl.style.transform = "translate(-50%, -100%) scaleX(1)";  
            }

            playerEl.querySelector('.body').style.backgroundColor = p.color;
            playerEl.querySelector('.backpack').style.backgroundColor = p.color;

            const displayGroup = p.group !== 'all' ? ` [${p.group.toUpperCase()}]` : '';
            playerEl.querySelector('.player-name').innerText = p.name + displayGroup;
            
            const dot = playerEl.querySelector('.status-dot');
            dot.className = `status-dot ${p.status}`;
            
            if (p.status === 'idle') {
                playerEl.classList.add('idle-mode');
                playerEl.classList.remove('offline-mode');
            } else if (p.status === 'offline') {
                playerEl.classList.add('offline-mode');
                playerEl.classList.remove('idle-mode');
            } else {
                playerEl.classList.remove('idle-mode', 'offline-mode');
            }

            radarHTML += `
                <div class="d-flex align-items-center mb-2 text-light p-1 rounded" style="background: rgba(255,255,255,0.05); border-left: 2px solid ${p.color}; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span class="status-dot ${p.status} me-2"></span> 
                    <span class="fw-bold" style="color: #eee;">${p.name}</span>
                    <span class="text-secondary small ms-1">${displayGroup}</span>
                    <span class="ms-auto text-muted small text-uppercase fw-bold" style="font-size: 0.65rem; letter-spacing: 0.5px;">${p.status}</span>
                </div>
            `;
        });

        if (radarList) radarList.innerHTML = radarHTML;
    }

    if (btnBackToWork) {
        btnBackToWork.addEventListener('click', function() {
            window.location.href = '/dashboard/';
        });
    }

    setInterval(syncMultiplayer, 5000);
    syncMultiplayer();
});