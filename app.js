document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. 스크롤 페이드인 애니메이션 (Intersection Observer)
    // ==========================================
    const fadeElements = document.querySelectorAll('.fade-in');

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.3
    };

    const fadeObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // 한번 보여진 후에는 observer 해제 (계속 보고싶다면 주석처리)
                // observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    fadeElements.forEach(el => fadeObserver.observe(el));

    // ==========================================
    // 2. 모달 및 인증 폼 전환 로직
    // ==========================================
    const authModal = document.getElementById('auth-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    
    // 모달 열기 버튼
    const btnShowLogin = document.getElementById('btn-show-login');
    const btnShowSignup = document.getElementById('btn-show-signup');
    
    // 뷰(View) 컨테이너
    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const findView = document.getElementById('find-view');

    // 링크(Links)
    const linkToSignup = document.getElementById('link-to-signup');
    const linkToLogin = document.getElementById('link-to-login');
    const linkToFind = document.getElementById('link-to-find');
    const linkToLoginFromFind = document.getElementById('link-to-login-from-find');

    // 뷰 전환 함수
    function showView(viewToShow) {
        loginView.classList.add('hidden');
        signupView.classList.add('hidden');
        findView.classList.add('hidden');
        
        viewToShow.classList.remove('hidden');
    }

    // 모달 제어
    function openModal(view) {
        showView(view);
        authModal.classList.remove('hidden');
    }

    function closeModal() {
        authModal.classList.add('hidden');
        // 모달 닫을 때 모든 폼 초기화 (작성 중 내용 삭제)
        document.querySelectorAll('form').forEach(form => form.reset());
    }

    // 이벤트 리스너 등록 (모달)
    btnShowLogin.addEventListener('click', () => openModal(loginView));
    btnShowSignup.addEventListener('click', () => openModal(signupView));
    btnCloseModal.addEventListener('click', closeModal);

    // 모달 바깥 배경 클릭 시 닫기
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
            closeModal();
        }
    });

    // 링크 클릭 시 뷰 전환
    linkToSignup.addEventListener('click', (e) => {
        e.preventDefault();
        showView(signupView);
    });

    linkToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showView(loginView);
    });

    linkToFind.addEventListener('click', (e) => {
        e.preventDefault();
        showView(findView);
    });

    linkToLoginFromFind.addEventListener('click', (e) => {
        e.preventDefault();
        showView(loginView);
    });

    // ==========================================
    // 3. Supabase Auth 연동 및 인증 로직
    // ==========================================
    const supabaseUrl = 'https://qqaarpywthduklxdficn.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxYWFycHl3dGhkdWtseGRmaWNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDM5MTEsImV4cCI6MjA5ODUxOTkxMX0.r6LAUTvApmDu0neJMZ9pKOwicxHx3BgjOU1I9LaujOM';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // 로그인 상태에 따른 UI 업데이트
    async function updateAuthUI() {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            // 로그인 상태면 대시보드 페이지로 이동
            window.location.href = 'dashboard.html';
        }
    }

    // 초기 상태 체크
    updateAuthUI();

    // 로그인 폼 제출 처리
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = e.target.querySelector('button');
        btn.textContent = '로그인 중...';
        btn.disabled = true;
        
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        btn.textContent = '로그인';
        btn.disabled = false;

        if (error) {
            alert('로그인 실패: ' + error.message);
        } else {
            alert('로그인 성공!');
            closeModal();
            updateAuthUI();
        }
    });

    // 회원가입 폼 엔터키 기본 제출 막기
    document.getElementById('signup-form').addEventListener('submit', (e) => {
        e.preventDefault();
    });

    // 가입하기 버튼 명시적 클릭 처리
    document.getElementById('btn-submit-signup').addEventListener('click', async (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        
        if (!username || !email || !password) {
            alert('모든 정보를 입력해주세요.');
            return;
        }

        const btn = e.target;
        btn.textContent = '가입 중...';
        btn.disabled = true;
        
        // Supabase Auth 회원가입 (profiles 트리거가 없으므로 수동 삽입 처리하거나 별도 로직 필요, 기본은 auth.users에 등록)
        const { data, error } = await supabase.auth.signUp({ 
           email, password, options: { data: { username } } 
        });

        btn.textContent = '가입하기';
        btn.disabled = false;

        if (error) {
            let errorMsg = error.message;
            if (errorMsg.includes('rate limit')) {
                errorMsg = '가입 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.\\n(개발 중이시라면 Supabase 대시보드 Auth 설정에서 Rate Limit을 완화해주세요.)';
            } else if (errorMsg.includes('at least 6 characters')) {
                errorMsg = '비밀번호는 최소 6자리 이상이어야 합니다.';
            } else if (errorMsg.includes('invalid format')) {
                errorMsg = '올바른 이메일 형식이 아닙니다.';
            } else if (errorMsg.includes('already registered')) {
                errorMsg = '이미 가입된 이메일입니다.';
            }
            alert('회원가입 실패: ' + errorMsg);
        } else {
            // profiles 테이블에 유저 정보 명시적 삽입 시도 (signUp 성공 후 user가 반환될 경우)
            if (data?.user) {
                await supabase.from('profiles').insert([
                    { id: data.user.id, username: username }
                ]);
            }
            alert('회원가입 성공! 로그인 화면으로 이동합니다. (이메일 인증이 설정된 경우 이메일을 확인해주세요)');
            showView(loginView);
        }
    });

    // 비밀번호 재설정 제출 처리
    document.getElementById('reset-pw-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        const btn = e.target.querySelector('button');
        btn.textContent = '전송 중...';
        btn.disabled = true;
        
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/update-password.html',
        });

        btn.textContent = '링크 전송';
        btn.disabled = false;

        if (error) {
            alert('오류 발생: ' + error.message);
        } else {
            alert('비밀번호 재설정 메일이 전송되었습니다.');
            showView(loginView);
        }
    });
});
