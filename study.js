(function() {
const supabaseUrl = 'https://qqaarpywthduklxdficn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxYWFycHl3dGhkdWtseGRmaWNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDM5MTEsImV4cCI6MjA5ODUxOTkxMX0.r6LAUTvApmDu0neJMZ9pKOwicxHx3BgjOU1I9LaujOM';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let seconds = 0;
let userSession = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 세션 확인 (로그인 유저만 접근 가능)
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        alert('로그인이 필요한 서비스입니다.');
        window.location.href = 'index.html';
        return;
    }
    userSession = user;

    // Parse URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room_id');
    if (!roomId) {
        alert('올바르지 않은 접근입니다. 메인 대시보드에서 방을 선택해주세요.');
        window.location.href = 'dashboard.html';
        return;
    }

    // 스터디룸 정보 가져오기
    const { data: room, error: roomError } = await supabaseClient
        .from('study_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

    if (roomError || !room) {
        alert('존재하지 않는 스터디룸입니다.');
        window.location.href = 'dashboard.html';
        return;
    }

    // 룸 정보 배너 렌더링
    const banner = document.getElementById('room-info-banner');
    const bannerTitle = document.getElementById('room-info-title');
    const bannerTag = document.getElementById('room-info-tag');
    const bannerCodeDisplay = document.getElementById('room-code-display');
    const bannerCodeText = document.getElementById('room-code-text');
    const btnCopyCode = document.getElementById('btn-copy-code');

    if (banner) {
        banner.style.display = 'flex';
        if (bannerTitle) bannerTitle.textContent = room.name;
        if (bannerTag) {
            if (room.is_private) {
                bannerTag.textContent = '비밀방';
                bannerTag.className = 'room-info-tag private';
                if (bannerCodeDisplay) bannerCodeDisplay.style.display = 'flex';
                if (bannerCodeText) bannerCodeText.textContent = room.room_code;
            } else {
                bannerTag.textContent = '공개방';
                bannerTag.className = 'room-info-tag public';
                if (bannerCodeDisplay) bannerCodeDisplay.style.display = 'none';
            }
        }
    }

    if (btnCopyCode && room.room_code) {
        btnCopyCode.addEventListener('click', () => {
            navigator.clipboard.writeText(room.room_code).then(() => {
                alert('참여 코드가 클립보드에 복사되었습니다!');
            }).catch(err => {
                console.error('Copy failed: ', err);
            });
        });
    }

    // 본인 닉네임 설정
    const { data: profile } = await supabaseClient.from('profiles').select('username').eq('id', user.id).single();
    const myName = profile?.username || user.email.split('@')[0];
    const nameLabels = document.querySelectorAll('.participant-name');
    if(nameLabels.length > 0) {
        nameLabels[0].textContent = myName + " (나)";
    }

    const timerDisplay = document.getElementById('timer');
    const btnExit = document.getElementById('btn-exit');

    // ==========================================
    // 1. Sidebar Toggle & Scroll Logic
    // ==========================================
    const btnTogglePomo = document.getElementById('btn-toggle-pomo');
    const btnToggleTodo = document.getElementById('btn-toggle-todo');
    const btnToggleChat = document.getElementById('btn-toggle-chat');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');
    const sidebar = document.getElementById('study-sidebar');
    
    let activeTab = null; // 'pomo', 'todo', or 'chat'

    function openSidebarAndScrollTo(target) {
        sidebar.classList.add('open');
        document.body.classList.add('sidebar-open');
        activeTab = target;
        
        setTimeout(() => {
            let cardClass = '';
            if (target === 'pomo') cardClass = '.pomodoro-card';
            else if (target === 'todo') cardClass = '.todo-card';
            else if (target === 'chat') cardClass = '.chat-card';
            
            const card = document.querySelector(cardClass);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                if (target === 'chat') {
                    scrollToBottom();
                }
            }
        }, 150);
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        document.body.classList.remove('sidebar-open');
        activeTab = null;
    }

    function handlePomoClick() {
        if (!sidebar.classList.contains('open')) {
            openSidebarAndScrollTo('pomo');
        } else {
            if (activeTab === 'pomo') {
                closeSidebar();
            } else {
                openSidebarAndScrollTo('pomo');
            }
        }
    }

    function handleTodoClick() {
        if (!sidebar.classList.contains('open')) {
            openSidebarAndScrollTo('todo');
        } else {
            if (activeTab === 'todo') {
                closeSidebar();
            } else {
                openSidebarAndScrollTo('todo');
            }
        }
    }

    function handleChatClick() {
        if (!sidebar.classList.contains('open')) {
            openSidebarAndScrollTo('chat');
        } else {
            if (activeTab === 'chat') {
                closeSidebar();
            } else {
                openSidebarAndScrollTo('chat');
            }
        }
    }

    if (btnTogglePomo) btnTogglePomo.addEventListener('click', handlePomoClick);
    if (btnToggleTodo) btnToggleTodo.addEventListener('click', handleTodoClick);
    if (btnToggleChat) btnToggleChat.addEventListener('click', handleChatClick);
    if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', closeSidebar);

    // ==========================================
    // 2. Pomodoro Timer Logic
    // ==========================================
    let pomoMode = 'focus'; // 'focus' or 'break'
    let pomoSecondsRemaining = 25 * 60;
    let pomoRunning = false;
    let pomoInterval = null;

    const pomoDisplay = document.getElementById('pomo-timer-display');
    const btnPomoStart = document.getElementById('btn-pomo-start');
    const btnPomoReset = document.getElementById('btn-pomo-reset');
    const btnPomoFocus = document.getElementById('btn-pomo-focus');
    const btnPomoBreak = document.getElementById('btn-pomo-break');
    const accumTimeDisplay = document.getElementById('session-accumulated-time');

    function updatePomoDisplay() {
        const m = Math.floor(pomoSecondsRemaining / 60).toString().padStart(2, '0');
        const s = (pomoSecondsRemaining % 60).toString().padStart(2, '0');
        const timeStr = `${m}:${s}`;
        
        if (timerDisplay) timerDisplay.textContent = timeStr;
        if (pomoDisplay) pomoDisplay.textContent = timeStr;
        
        // Update mini-timer color theme based on mode
        if (timerDisplay) {
            if (pomoMode === 'focus') {
                timerDisplay.style.backgroundColor = 'rgba(217, 48, 37, 0.9)'; // Red
            } else {
                timerDisplay.style.backgroundColor = 'rgba(38, 208, 206, 0.9)'; // Cyan
            }
            
            if (pomoRunning) {
                timerDisplay.classList.remove('paused');
            } else {
                timerDisplay.classList.add('paused');
            }
        }

        // Update accumulated time
        if (accumTimeDisplay) {
            const totalM = Math.floor(seconds / 60);
            const totalS = seconds % 60;
            accumTimeDisplay.textContent = `${totalM}분 ${totalS}초`;
        }
    }

    function switchPomoMode(mode) {
        pausePomo();
        pomoMode = mode;
        if (mode === 'focus') {
            pomoSecondsRemaining = 25 * 60;
            if (btnPomoFocus) btnPomoFocus.classList.add('active');
            if (btnPomoBreak) btnPomoBreak.classList.remove('active');
        } else {
            pomoSecondsRemaining = 5 * 60;
            if (btnPomoFocus) btnPomoFocus.classList.remove('active');
            if (btnPomoBreak) btnPomoBreak.classList.add('active');
        }
        updatePomoDisplay();
    }

    function startPomo() {
        if (!pomoRunning) {
            pomoRunning = true;
            if (btnPomoStart) {
                btnPomoStart.textContent = '정지';
                btnPomoStart.classList.remove('btn-primary');
                btnPomoStart.classList.add('btn-secondary');
            }
            
            pomoInterval = setInterval(() => {
                if (pomoSecondsRemaining > 0) {
                    pomoSecondsRemaining--;
                    if (pomoMode === 'focus') {
                        seconds++;
                    }
                    updatePomoDisplay();
                } else {
                    playAlertSound();
                    pausePomo();
                    if (pomoMode === 'focus') {
                        alert('🎉 집중 시간이 끝났습니다! 5분 휴식을 시작해보세요.');
                        switchPomoMode('break');
                    } else {
                        alert('⏱️ 휴식 시간이 끝났습니다! 다시 집중해볼까요?');
                        switchPomoMode('focus');
                    }
                }
            }, 1000);
            updatePomoDisplay();
        }
    }

    function pausePomo() {
        if (pomoRunning) {
            pomoRunning = false;
            clearInterval(pomoInterval);
            if (btnPomoStart) {
                btnPomoStart.textContent = '시작';
                btnPomoStart.classList.remove('btn-secondary');
                btnPomoStart.classList.add('btn-primary');
            }
            updatePomoDisplay();
        }
    }

    function resetPomo() {
        pausePomo();
        if (pomoMode === 'focus') {
            pomoSecondsRemaining = 25 * 60;
        } else {
            pomoSecondsRemaining = 5 * 60;
        }
        updatePomoDisplay();
    }

    if (btnPomoStart) {
        btnPomoStart.addEventListener('click', () => {
            if (pomoRunning) {
                pausePomo();
            } else {
                startPomo();
            }
        });
    }

    if (btnPomoReset) {
        btnPomoReset.addEventListener('click', resetPomo);
    }

    if (btnPomoFocus) {
        btnPomoFocus.addEventListener('click', () => switchPomoMode('focus'));
    }

    if (btnPomoBreak) {
        btnPomoBreak.addEventListener('click', () => switchPomoMode('break'));
    }

    if (timerDisplay) {
        timerDisplay.addEventListener('click', () => {
            if (pomoRunning) {
                pausePomo();
            } else {
                startPomo();
            }
        });
    }

    // Dynamic beep/chime generation using Web Audio API
    function playAlertSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const playTone = (frequency, startTime, duration) => {
                const osc = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                
                osc.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(frequency, startTime);
                
                gainNode.gain.setValueAtTime(0.2, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.05);
                
                osc.start(startTime);
                osc.stop(startTime + duration);
            };
            
            // Play E5 then A5
            playTone(659.25, audioCtx.currentTime, 0.4);
            playTone(880.00, audioCtx.currentTime + 0.35, 0.6);
        } catch (e) {
            console.error("Audio Context not supported or allowed: ", e);
        }
    }

    // Initialize timer displays & Auto Start Focus Timer
    updatePomoDisplay();
    startPomo();

    // ==========================================
    // 3. Supabase To-Do List Logic
    // ==========================================
    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const todoList = document.getElementById('todo-list');
    const todoProgress = document.getElementById('todo-progress');
    const todoProgressText = document.getElementById('todo-progress-text');
    let localTodos = [];

    function escapeHtml(string) {
        return String(string).replace(/[&<>"']/g, function (s) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[s];
        });
    }

    function updateTodoProgress() {
        const total = localTodos.length;
        const completed = localTodos.filter(t => t.is_completed).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        if (todoProgress) todoProgress.style.width = `${percent}%`;
        if (todoProgressText) todoProgressText.textContent = `${completed} / ${total} 완료`;
    }

    function renderTodos() {
        if (!todoList) return;
        todoList.innerHTML = '';
        
        localTodos.forEach(todo => {
            const li = document.createElement('li');
            li.className = `todo-item ${todo.is_completed ? 'completed' : ''}`;
            li.dataset.id = todo.id;
            
            li.innerHTML = `
                <div class="todo-item-left">
                    <input type="checkbox" ${todo.is_completed ? 'checked' : ''}>
                    <span class="todo-item-text">${escapeHtml(todo.task)}</span>
                </div>
                <button class="btn-todo-delete" title="삭제">🗑️</button>
            `;
            
            // Checkbox change listener
            const checkbox = li.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', async (e) => {
                const isChecked = e.target.checked;
                todo.is_completed = isChecked;
                if (isChecked) {
                    li.classList.add('completed');
                } else {
                    li.classList.remove('completed');
                }
                updateTodoProgress();
                
                const { error } = await supabaseClient
                    .from('todos')
                    .update({ is_completed: isChecked })
                    .eq('id', todo.id);
                
                if (error) {
                    console.error("Todo update failed: ", error);
                    // Revert on error
                    todo.is_completed = !isChecked;
                    checkbox.checked = !isChecked;
                    li.classList.toggle('completed', !isChecked);
                    updateTodoProgress();
                    alert('수정에 실패했습니다: ' + error.message);
                }
            });
            
            // Delete button click listener
            const btnDelete = li.querySelector('.btn-todo-delete');
            btnDelete.addEventListener('click', async () => {
                localTodos = localTodos.filter(t => t.id !== todo.id);
                li.remove();
                updateTodoProgress();
                
                const { error } = await supabaseClient
                    .from('todos')
                    .delete()
                    .eq('id', todo.id);
                
                if (error) {
                    console.error("Todo delete failed: ", error);
                    alert('삭제에 실패했습니다: ' + error.message);
                    fetchTodos(); // Restore original list on error
                }
            });
            
            todoList.appendChild(li);
        });
        
        updateTodoProgress();
    }

    async function fetchTodos() {
        if (!userSession) return;
        const { data, error } = await supabaseClient
            .from('todos')
            .select('*')
            .eq('user_id', userSession.id)
            .order('created_at', { ascending: true });
            
        if (error) {
            console.error("Fetching todos failed: ", error);
        } else if (data) {
            localTodos = data;
            renderTodos();
        }
    }

    // Fetch todos on load
    fetchTodos();

    if (todoForm) {
        todoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = todoInput.value.trim();
            if (!text) return;
            
            todoInput.value = '';
            
            // Insert todo into Supabase
            const { data, error } = await supabaseClient
                .from('todos')
                .insert([{ user_id: userSession.id, task: text, is_completed: false }])
                .select();
                
            if (error) {
                console.error("Adding todo failed: ", error);
                alert('할 일 추가에 실패했습니다: ' + error.message);
            } else if (data && data.length > 0) {
                localTodos.push(data[0]);
                renderTodos();
            }
        });
    }

    // ==========================================
    // 4. Supabase Real-time Chat Logic
    // ==========================================
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessagesContainer = document.getElementById('chat-messages-container');

    function scrollToBottom() {
        if (chatMessagesContainer) {
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }
    }

    function getAvatarColor(userId) {
        const colors = [
            '#e8710a', // Orange
            '#0f9d58', // Green
            '#ab47bc', // Purple
            '#24b6f7', // Light Blue
            '#f06292', // Pink
            '#00acc1', // Teal
            '#f5c242', // Yellow
            '#8ab4f8'  // Blue
        ];
        let hash = 0;
        if (userId) {
            for (let i = 0; i < userId.length; i++) {
                hash = userId.charCodeAt(i) + ((hash << 5) - hash);
            }
        }
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    }

    function appendChatMessage(msg, shouldScroll = true) {
        if (!chatMessagesContainer) return;
        
        // Prevent duplicates
        if (chatMessagesContainer.querySelector(`[data-msg-id="${msg.id}"]`)) return;

        const isMe = msg.user_id === userSession.id;
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isMe ? 'me' : 'other'}`;
        bubble.dataset.msgId = msg.id;

        const date = new Date(msg.created_at);
        const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

        bubble.innerHTML = `
            <div class="chat-sender">${escapeHtml(msg.username)}</div>
            <div class="chat-text">${escapeHtml(msg.message)}</div>
            <div class="chat-time">${timeStr}</div>
        `;

        chatMessagesContainer.appendChild(bubble);
        
        if (shouldScroll) {
            scrollToBottom();
        }
    }

    async function fetchChatMessages() {
        if (!userSession) return;
        const { data, error } = await supabaseClient
            .from('study_messages')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: true })
            .limit(50);
            
        if (error) {
            console.error("Fetching chat messages failed: ", error);
        } else if (data) {
            if (chatMessagesContainer) {
                chatMessagesContainer.innerHTML = '';
                data.forEach(msg => appendChatMessage(msg, false));
                scrollToBottom();
            }
        }
    }

    // Fetch and subscribe to chat messages
    fetchChatMessages();

    const chatChannel = supabaseClient
        .channel(`room_chat:${roomId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'study_messages',
                filter: `room_id=eq.${roomId}`
            },
            (payload) => {
                const newMsg = payload.new;
                appendChatMessage(newMsg, true);
            }
        )
        .subscribe();

    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = chatInput.value.trim();
            if (!text) return;
            
            chatInput.value = '';
            
            // Insert chat message into Supabase
            const { error } = await supabaseClient
                .from('study_messages')
                .insert([{ user_id: userSession.id, username: myName, message: text, room_id: roomId }]);
                
            if (error) {
                console.error("Adding chat message failed: ", error);
                alert('메시지 전송에 실패했습니다: ' + error.message);
            }
        });
    }

    // 타이머 종료 및 DB 저장 (통화 종료 버튼)
    btnExit.addEventListener('click', async () => {
        pausePomo();

        const studyMinutes = Math.floor(seconds / 60);
        
        // 1분 미만은 저장하지 않고 바로 나가기 여부 묻기
        if (studyMinutes < 1) {
            if (confirm('1분 미만은 누적 시간에 기록되지 않습니다. 스터디를 마치시겠습니까?')) {
                window.location.href = 'dashboard.html';
            } else {
                startPomo();
            }
            return;
        }

        btnExit.style.opacity = '0.5';
        btnExit.disabled = true;

        // Supabase DB에 세션 기록 추가
        const { error } = await supabaseClient.from('study_sessions').insert([
            { user_id: userSession.id, duration_minutes: studyMinutes }
        ]);

        if (error) {
            alert('기록 저장에 실패했습니다: ' + error.message);
            btnExit.style.opacity = '1';
            btnExit.disabled = false;
            startPomo();
        } else {
            alert(`🎉 수고하셨습니다! 총 ${studyMinutes}분이 기록되었습니다.`);
            window.location.href = 'dashboard.html';
        }
    });

    // ==========================================
    // 5. 유튜브 영상 랜덤 로드 및 스터디원 그리드
    // ==========================================
    const videoIds = [
        '5qap5aO4i9A', // Lofi Girl
        's_k_mK8QxV8', // 파리 도서관 백색소음
        'c0_ejQQcrwI', // 비오는 날 카페
        'UGWt_4tYw18', // ASMR 🔥
        'jfKfPfyJRdk', // Lofi Hip Hop Live
        '4xDzrDKg11J', // 해변 파도소리
        'Dx5qFachd3A'  // 비오는 창밖
    ];
    
    let selectedVideos = [];
    if (room.video_id) {
        selectedVideos.push(room.video_id);
        const others = videoIds.filter(id => id !== room.video_id).sort(() => 0.5 - Math.random());
        while (selectedVideos.length < 5) {
            selectedVideos.push(...others.slice(0, 5 - selectedVideos.length));
        }
    } else {
        const shuffled = videoIds.sort(() => 0.5 - Math.random());
        while (selectedVideos.length < 5) {
            selectedVideos.push(...shuffled.slice(0, 5 - selectedVideos.length));
        }
    }

    // 슬롯 1-5의 기존 HTML 구조 및 영상 ID 보관
    const originalSlotsContent = {};
    const slotVideoIds = {};
    for (let i = 1; i <= 5; i++) {
        const slotEl = document.getElementById(`slot-${i}`);
        if (slotEl) {
            originalSlotsContent[i] = slotEl.innerHTML;
        }
    }
    
    // iframe들에 기본 추천 영상 할당
    const iframes = document.querySelectorAll('.yt-iframe');
    iframes.forEach((iframe, index) => {
        const slotId = index + 1; // 슬롯 1-5
        if (selectedVideos[index]) {
            slotVideoIds[slotId] = selectedVideos[index];
            const vid = selectedVideos[index];
            iframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&loop=1&playlist=${vid}&controls=0&modestbranding=1`;
        }
    });

    // ==========================================
    // 6. Supabase Real-time Presence (실시간 유저 동기화)
    // ==========================================
    const roomChannel = supabaseClient.channel(`room_presence:${roomId}`, {
        config: {
            presence: {
                key: userSession.id,
            },
        },
    });

    roomChannel
        .on('presence', { event: 'sync' }, () => {
            const state = roomChannel.presenceState();
            
            // 나를 제외한 접속한 실시간 유저 목록 추출
            const activeUsers = [];
            Object.keys(state).forEach(key => {
                if (key !== userSession.id) {
                    const presences = state[key];
                    if (presences && presences.length > 0) {
                        activeUsers.push({
                            id: key,
                            username: presences[0].username || '알 수 없음'
                        });
                    }
                }
            });

            // 그리드 슬롯 1-5 갱신
            for (let i = 1; i <= 5; i++) {
                const slotEl = document.getElementById(`slot-${i}`);
                if (!slotEl) continue;

                const userIndex = i - 1;
                if (userIndex < activeUsers.length) {
                    // 실시간 접속 유저가 있을 경우 아바타로 교체
                    const user = activeUsers[userIndex];
                    const avatarColor = getAvatarColor(user.id);
                    slotEl.innerHTML = `
                        <div class="my-avatar-container">
                            <div class="my-avatar-circle" style="background-color: ${avatarColor};">
                                <svg viewBox="0 0 24 24" class="my-avatar-svg">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="participant-name">${escapeHtml(user.username)}</div>
                    `;
                } else if (activeUsers.length > 0) {
                    // 실제 유저가 1명이라도 있으면 나머지 빈 슬롯은 대기 상태로 표시
                    slotEl.innerHTML = `
                        <div class="my-avatar-container">
                            <div style="display:flex;flex-direction:column;align-items:center;gap:8px;opacity:0.3;">
                                <svg viewBox="0 0 24 24" style="width:50px;height:50px;fill:#888;">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                </svg>
                                <span style="color:#666;font-size:0.75rem;">대기 중...</span>
                            </div>
                        </div>
                    `;
                } else {
                    // 접속 유저가 아무도 없으면 유튜브 스트림 원복
                    if (!slotEl.querySelector('.yt-iframe')) {
                        slotEl.innerHTML = originalSlotsContent[i];
                        const restoredIframe = slotEl.querySelector('.yt-iframe');
                        const vid = slotVideoIds[i];
                        if (restoredIframe && vid) {
                            restoredIframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&loop=1&playlist=${vid}&controls=0&modestbranding=1`;
                        }
                    }
                }
            }
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await roomChannel.track({
                    username: myName,
                    online_at: new Date().toISOString()
                });
            }
        });
});
})();
