// ============================================================================
// Baccalaureate Academy - Main Application Controller (RTL Arabic SPA)
// ============================================================================
(function(global) {
  const AppState = {
    currentView: 'home', // home | stage | subject | exams | exam_runner | pricing | news | student_dashboard | admin_dashboard
    selectedStageId: 'grade_2',
    selectedTrackFilter: 'all',
    selectedSubjectId: 'sub_g2_arabic',
    selectedLessonId: null,
    lessonTab: 'video', // video | pdf | quiz | exams
    videoMode: 'studio', // studio | youtube
    studioPlaying: false,
    studioSeconds: 0,
    studioSpeed: 1,
    studioMuted: false,
    studioSlideIdx: 0,
    waModalData: null,
    studioInterval: null,
    quizAnswers: {},
    quizSubmitted: false,
    examStageFilter: 'all',
    examSubjectFilter: 'all',
    activeExamId: null,
    activeExamOpportunity: 'الفرصة الأولى الأساسية',
    activeExamAnswers: {},
    activeExamSecondsLeft: 0,
    activeExamTimer: null,
    lastExamResult: null,
    checkoutPlanId: 'plan_track',
    checkoutSubjectId: 'sub_g2_english',
    checkoutPaymentMethod: 'بطاقة ميزة / بنكية',
    adminTab: 'overview', // overview | users | stages_subjects | lessons_exams | subscriptions | rbac | database | backups
    searchOpen: false,
    searchQuery: '',
    notifOpen: false,
    authModalOpen: false,
    authTab: 'student_login', // student_login | student_register | teacher_login | teacher_register | forgot_password | reset_password | admin_login
    resetEmail: '',
    issuedResetCode: '',
    courseStageFilter: 'all',
    courseSubjectFilter: 'all',
    courseTeacherFilter: 'all',
    courseSearchQuery: '',
    strictStageMode: true,
    lastGeneratedSignedUrl: '',
    lastLoggedOutEmail: '',
    chartInstances: {}
  };

  function escapeHtml(str) {
    return String(str === undefined || str === null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('bacc-toast-container');
    if (!container) return;
    const colors = {
      success: 'bg-teal-800 border-teal-500 text-white',
      error: 'bg-red-800 border-red-500 text-white',
      warning: 'bg-amber-700 border-amber-400 text-white',
      info: 'bg-slate-900 border-teal-400 text-white'
    };
    const toast = document.createElement('div');
    toast.className =
      'flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-xl border-r-4 text-sm font-bold transition-all duration-300 ' +
      (colors[type] || colors.info);
    toast.innerHTML =
      '<span>' +
      escapeHtml(message) +
      '</span><button type="button" class="text-white/80 hover:text-white font-black px-1" onclick="this.parentElement.remove()">✕</button>';
    container.appendChild(toast);
    setTimeout(() => {
      if (toast && toast.parentElement) toast.remove();
    }, 4500);
  }

  let _audioCtx = null;
  function playAcademySound(kind = 'start') {
    if (AppState.studioMuted) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!_audioCtx) _audioCtx = new AudioCtx();
      if (_audioCtx.state === 'suspended') _audioCtx.resume();
      const osc = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.type = 'sine';
      const now = _audioCtx.currentTime;
      if (kind === 'start') {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.14); // E5
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.28); // G5
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(_audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (kind === 'slide') {
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(_audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      }
    } catch (e) {}
  }

  function speakArabicLecture(textToSpeak) {
    if (AppState.studioMuted) return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(textToSpeak);
        utter.lang = 'ar-EG';
        utter.rate = AppState.studioSpeed || 1;
        utter.pitch = 1;
        const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
        const arVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('ar'));
        if (arVoice) utter.voice = arVoice;
        window.speechSynthesis.speak(utter);
      }
    } catch (e) {}
  }

  function stopArabicSpeech() {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch (e) {}
  }

  function normalizeVideoEmbedUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return 'https://www.youtube.com/embed/5sg9sCOXFIk';
    const m1 = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
    if (m1 && m1[1]) return 'https://www.youtube.com/embed/' + m1[1];
    return raw;
  }

  function clearTimers() {
    if (AppState.studioInterval) {
      clearInterval(AppState.studioInterval);
      AppState.studioInterval = null;
    }
    AppState.studioPlaying = false;
    stopArabicSpeech();
  }

  function clearExamTimer() {
    if (AppState.activeExamTimer) {
      clearInterval(AppState.activeExamTimer);
      AppState.activeExamTimer = null;
    }
  }

  function destroyCharts() {
    Object.keys(AppState.chartInstances).forEach(k => {
      if (AppState.chartInstances[k] && typeof AppState.chartInstances[k].destroy === 'function') {
        AppState.chartInstances[k].destroy();
      }
    });
    AppState.chartInstances = {};
  }

  function formatSeconds(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return (m < 10 ? '0' + m : m) + ':' + (rem < 10 ? '0' + rem : rem);
  }

  // ============================================================================
  // HEADER & NAVIGATION BAR
  // ============================================================================
  function renderNavbar() {
    const user = global.BaccDB.getCurrentUser();
    const notifications = global.BaccDB.getNotifications();
    const unreadCount = notifications.filter(n => !n.is_read).length;

    const navItemClass = viewKey =>
      AppState.currentView === viewKey
        ? 'bg-teal-700 text-white font-bold px-3 py-2 rounded-xl text-sm shadow-sm'
        : 'text-slate-700 hover:bg-teal-50 hover:text-teal-800 font-semibold px-3 py-2 rounded-xl text-sm transition';

    const stageNavClass = stgId =>
      AppState.currentView === 'stage' && AppState.selectedStageId === stgId
        ? 'bg-teal-700 text-white font-bold px-3 py-2 rounded-xl text-sm shadow-sm'
        : 'text-slate-700 hover:bg-teal-50 hover:text-teal-800 font-semibold px-3 py-2 rounded-xl text-sm transition';

    let userControlsHtml = '';
    if (!user) {
      userControlsHtml = `
        <button type="button" onclick="BaccApp.openAuthModal('student_login')" class="bg-teal-700 hover:bg-teal-800 text-white font-bold px-3 py-2 rounded-xl text-xs sm:text-sm shadow transition flex items-center gap-1">
          <span>👨‍🎓</span>
          <span>دخول / تسجيل</span>
        </button>
        <button type="button" onclick="BaccApp.openAuthModal('teacher_login')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold px-3 py-2 rounded-xl text-xs sm:text-sm transition flex items-center gap-1">
          <span>👨‍🏫</span>
          <span class="hidden sm:inline">المدرسون</span>
        </button>
        <button type="button" onclick="BaccApp.openAuthModal('admin_login')" class="bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/40 font-bold px-3 py-2 rounded-xl text-xs sm:text-sm shadow transition flex items-center gap-1">
          <span>🛡️</span>
          <span>المدير</span>
        </button>
      `;
    } else if (user.role === 'admin') {
      userControlsHtml = `
        <button type="button" onclick="BaccApp.navigate('admin_dashboard')" class="bg-gradient-to-l from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-slate-950 font-extrabold px-3 py-2 rounded-xl text-xs sm:text-sm shadow-md transition flex items-center gap-1">
          <span>🛡️</span>
          <span>لوحة المدير</span>
        </button>
        <button type="button" onclick="BaccApp.navigate('teacher_dashboard')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold px-2.5 py-2 rounded-xl text-xs transition">
          لوحة المدرس
        </button>
        <button type="button" onclick="BaccApp.navigate('student_dashboard')" class="bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 font-bold px-2.5 py-2 rounded-xl text-xs transition">
          لوحة الطالب
        </button>
        <button type="button" onclick="BaccApp.navigate('profile_page')" class="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-2.5 py-2 rounded-xl text-xs transition">
          👤 ملفي
        </button>
        <button type="button" onclick="BaccApp.logout()" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold px-2.5 py-2 rounded-xl text-xs transition">
          خروج
        </button>
      `;
    } else if (user.role === 'teacher') {
      userControlsHtml = `
        <button type="button" onclick="BaccApp.navigate('teacher_dashboard')" class="bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow transition flex items-center gap-1.5">
          <span>👨‍🏫</span>
          <span>لوحة المدرس (${escapeHtml(user.full_name.split(' ')[0])})</span>
        </button>
        <button type="button" onclick="BaccApp.navigate('profile_page')" class="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-2.5 py-2 rounded-xl text-xs transition">
          👤 الملف الشخصي
        </button>
        <button type="button" onclick="BaccApp.logout()" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold px-2.5 py-2 rounded-xl text-xs transition">
          خروج
        </button>
      `;
    } else {
      userControlsHtml = `
        <button type="button" onclick="BaccApp.navigate('student_dashboard')" class="bg-teal-700 hover:bg-teal-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow transition flex items-center gap-1.5">
          <span>📊</span>
          <span>لوحتي (${escapeHtml(user.full_name.split(' ')[0])})</span>
        </button>
        <button type="button" onclick="BaccApp.navigate('profile_page')" class="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-2.5 py-2 rounded-xl text-xs transition">
          👤 الملف الشخصي
        </button>
        <button type="button" onclick="BaccApp.logout()" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold px-2.5 py-2 rounded-xl text-xs transition">
          خروج
        </button>
      `;
    }

    return `
      <header class="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm no-print">
        <div class="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 cursor-pointer" onclick="BaccApp.navigate('home')">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-700 to-slate-900 flex items-center justify-center text-amber-400 font-black text-xl shadow">
              B
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-black text-base sm:text-lg text-slate-900 tracking-tight">Baccalaureate Academy</span>
                <span class="hidden sm:inline-block bg-amber-100 text-amber-900 text-[11px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300">البكالوريا المصرية 2027</span>
              </div>
              <p class="text-[11px] text-slate-500 font-medium hidden sm:block">المنصة المتكاملة للمراحل الثلاث والمسارات الأربعة</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button type="button" onclick="BaccApp.toggleSearchModal()" class="p-2 rounded-xl bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 transition flex items-center gap-1.5 text-xs font-bold" title="البحث الشامل">
              <span>🔍</span>
              <span class="hidden md:inline">بحث في المواد والدروس</span>
            </button>

            <div class="relative">
              <button type="button" onclick="BaccApp.toggleNotifications()" class="p-2 rounded-xl bg-slate-100 hover:bg-teal-50 text-slate-700 border border-slate-200 transition relative" title="الإشعارات">
                <span>🔔</span>
                ${
                  unreadCount > 0
                    ? `<span class="absolute -top-1 -left-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center bacc-badge-pulse">${unreadCount}</span>`
                    : ''
                }
              </button>
              ${
                AppState.notifOpen
                  ? `
                <div class="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                  <div class="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                    <span class="font-bold text-sm">🔔 الإشعارات والتنبيهات الأكاديمية</span>
                    <button type="button" onclick="BaccApp.markNotificationsRead()" class="text-xs text-amber-400 hover:underline font-bold">تحديد الكل كمقروء</button>
                  </div>
                  <div class="max-h-80 overflow-y-auto divide-y divide-slate-100 bacc-scrollbar">
                    ${notifications
                      .map(
                        n => `
                      <div class="p-3.5 ${n.is_read ? 'bg-white' : 'bg-teal-50/60'} hover:bg-slate-50 transition">
                        <div class="flex items-center justify-between gap-2 mb-1">
                          <span class="font-bold text-xs text-slate-900">${escapeHtml(n.title)}</span>
                          <span class="text-[10px] text-slate-400">${escapeHtml(n.created_at)}</span>
                        </div>
                        <p class="text-xs text-slate-600 leading-relaxed">${escapeHtml(n.message)}</p>
                      </div>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              `
                  : ''
              }
            </div>

            ${userControlsHtml}
          </div>
        </div>

        <nav class="bg-slate-50/90 border-t border-slate-200/80 px-3 sm:px-6 py-1.5 overflow-x-auto">
          <div class="max-w-7xl mx-auto flex items-center gap-1.5 whitespace-nowrap">
            <button type="button" onclick="BaccApp.navigate('home')" class="${navItemClass('home')}">🏠 الرئيسية</button>
            <button type="button" onclick="BaccApp.openStage('grade_1')" class="${stageNavClass('grade_1')}">📘 الصف الأول الثانوي</button>
            <button type="button" onclick="BaccApp.openStage('grade_2')" class="${stageNavClass('grade_2')}">📗 الصف الثاني الثانوي</button>
            <button type="button" onclick="BaccApp.openStage('grade_3')" class="${stageNavClass('grade_3')}">🎓 الصف الثالث الثانوي</button>
            <button type="button" onclick="BaccApp.navigate('courses')" class="${navItemClass('courses')}">🎞️ الكورسات التعليمية</button>
            <button type="button" onclick="BaccApp.navigate('exams')" class="${navItemClass('exams')}">📝 بنك الامتحانات الشاملة</button>
            <button type="button" onclick="BaccApp.navigate('pricing')" class="${navItemClass('pricing')}">💳 الاشتراكات والباقات</button>
            <button type="button" onclick="BaccApp.navigate('news')" class="${navItemClass('news')}">📰 الأخبار والقرارات</button>
          </div>
        </nav>
      </header>
    `;
  }

  // ============================================================================
  // HOME VIEW
  // ============================================================================
  function renderHomeView() {
    const stages = global.BaccDB.getStages();
    const tracks = global.BaccDB.getTracks().filter(t => t.id !== 'track_general');
    const teachers = global.BaccDB.getTeachers();
    const announcements = global.BaccDB.getAnnouncements().slice(0, 3);
    const allSubjects = global.BaccDB.getSubjects();

    return `
      <section class="bacc-hero-gradient text-white py-10 sm:py-14 px-4 sm:px-6 relative overflow-hidden">
        <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div class="lg:col-span-7 space-y-5">
            <div class="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-400/40 text-amber-300 px-3.5 py-1.5 rounded-full text-xs font-extrabold">
              <span>✨ معتمدة وفق أحدث قرارات وزارة التربية والتعليم المصرية 2026/2027</span>
            </div>
            <h1 class="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight">
              أكاديمية البكالوريا المصرية
              <span class="block text-amber-400 mt-1">Baccalaureate Academy</span>
            </h1>
            <p class="text-slate-200 text-sm sm:text-base leading-relaxed max-w-2xl">
              المنصة التعليمية الإلكترونية المتكاملة لطلاب المراحل الثانوية الثلاث بنظام شهادة البكالوريا المصرية الجديد. نجمع لك شرح المسارات الأربعة (الطب وعلوم الحياة، الهندسة وعلوم الحاسب، الأعمال، الآداب والفنون)، ومواد المستوى المتقدم، والمذكرات التفاعلية، ومحاكاة امتحانات الفرصة الأولى والثانية باحتساب الدرجة الأعلى من 600 درجة.
            </p>
            <div class="flex flex-wrap items-center gap-3 pt-2">
              <button type="button" onclick="BaccApp.openStage('grade_2')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-3 rounded-xl text-sm shadow-lg transition">
                🚀 استكشف المراحل والمواد الدراسية
              </button>
              <button type="button" onclick="BaccApp.navigate('exams')" class="bg-white/10 hover:bg-white/20 text-white border border-white/25 font-bold px-5 py-3 rounded-xl text-sm transition">
                📝 خُض اختباراً تجريبياً الآن
              </button>
              <button type="button" onclick="BaccApp.scrollToSection('bacc-calculator-sec')" class="bg-teal-600/40 hover:bg-teal-600/60 text-teal-100 border border-teal-400/30 font-bold px-4 py-3 rounded-xl text-sm transition">
                🧮 حاسبة مجموع البكالوريا (600 درجة)
              </button>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
              <div class="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                <div class="text-amber-400 font-black text-xl">${allSubjects.length} مادة</div>
                <div class="text-xs text-slate-300">مقررات البكالوريا الرسمية</div>
              </div>
              <div class="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                <div class="text-teal-300 font-black text-xl">4 مسارات</div>
                <div class="text-xs text-slate-300">تخصصية مؤهلة للجامعات</div>
              </div>
              <div class="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                <div class="text-amber-400 font-black text-xl">600 درجة</div>
                <div class="text-xs text-slate-300">المجموع التراكمي للشهادة</div>
              </div>
              <div class="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                <div class="text-teal-300 font-black text-xl">فرصتان</div>
                <div class="text-xs text-slate-300">امتحان سنوياً والدرجة الأعلى</div>
              </div>
            </div>
          </div>

          <div class="lg:col-span-5">
            <div class="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-400/40 bg-slate-900">
              <img src="assets/hero.jpg" alt="Baccalaureate Academy Hero" class="w-full h-auto object-cover" />
              <div class="p-4 bg-slate-950/90 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span class="text-xs text-amber-400 font-bold block">نظام التقييم المستمر والامتحانات التفاعلية</span>
                  <span class="text-xs text-slate-300">شرط 60% تقييمات أسبوعية وشهرية + تصحيح إلكتروني فوري</span>
                </div>
                <span class="bg-teal-700 text-white text-xs font-bold px-3 py-1 rounded-lg">مباشر</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between mb-7 gap-3">
          <div>
            <span class="text-xs font-extrabold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">المراحل الدراسية الثلاث</span>
            <h2 class="text-2xl sm:text-3xl font-black text-slate-900 mt-2">اختر مرحلتك الدراسية في البكالوريا المصرية</h2>
          </div>
          <p class="text-xs sm:text-sm text-slate-600 max-w-md">
            لكل مرحلة صفحة مستقلة تحتوي على المواد الدراسية الرسمية، مقسمة حسب المسارات مع الفيديوهات والمذكرات والامتحانات.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${stages
            .map((stg, idx) => {
              const stageSubjects = allSubjects.filter(s => s.stage_id === stg.id);
              const badgeColors = [
                'from-teal-700 to-emerald-800',
                'from-blue-800 to-indigo-900',
                'from-slate-900 to-amber-900'
              ];
              return `
              <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between bacc-card-hover">
                <div>
                  <div class="bg-gradient-to-l ${badgeColors[idx % 3]} text-white p-5">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs font-extrabold bg-white/20 px-2.5 py-1 rounded-full">${escapeHtml(stg.badge)}</span>
                      <span class="text-xs font-bold text-amber-300">${stageSubjects.length} مقررات متاحة</span>
                    </div>
                    <h3 class="text-xl font-black">${escapeHtml(stg.name)}</h3>
                    <p class="text-xs text-slate-200 mt-1">${escapeHtml(stg.subtitle)}</p>
                  </div>
                  <div class="p-5 space-y-3">
                    <p class="text-xs text-slate-600 leading-relaxed">${escapeHtml(stg.description)}</p>
                    <div class="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                      ${(stg.highlights || [])
                        .map(
                          h => `
                        <div class="flex items-start gap-2 text-xs text-slate-700 font-medium">
                          <span class="text-teal-600 font-black">✓</span>
                          <span>${escapeHtml(h)}</span>
                        </div>
                      `
                        )
                        .join('')}
                    </div>
                  </div>
                </div>
                <div class="px-5 pb-5 pt-2">
                  <button type="button" onclick="BaccApp.openStage('${stg.id}')" class="w-full bg-slate-900 hover:bg-teal-800 text-white font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2">
                    <span>دخول صفحة ${escapeHtml(stg.name)}</span>
                    <span>←</span>
                  </button>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </section>

      <section class="bg-white border-y border-slate-200 py-10 px-4 sm:px-6">
        <div class="max-w-7xl mx-auto">
          <div class="text-center max-w-3xl mx-auto mb-8">
            <span class="text-xs font-extrabold text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">بديل الشعبتين التقليديتين</span>
            <h2 class="text-2xl sm:text-3xl font-black text-slate-900 mt-2">المسارات التخصصية الأربعة في البكالوريا المصرية</h2>
            <p class="text-xs sm:text-sm text-slate-600 mt-1">
              يختار الطالب مساره بدءاً من الصف الثاني الثانوي مع إمكانية التحويل بين المسارات بشرط استكمال مواد التخصص المقررة.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            ${tracks
              .map(
                t => `
              <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 flex flex-col justify-between bacc-card-hover">
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-teal-100 text-teal-900">${escapeHtml(t.shortName)}</span>
                    <span class="text-lg">🎯</span>
                  </div>
                  <h3 class="text-lg font-black text-slate-900">${escapeHtml(t.name)}</h3>
                  <p class="text-xs text-teal-800 font-bold">${escapeHtml(t.equivalent_to)}</p>
                  <div class="text-xs text-slate-700 space-y-2 bg-white p-3 rounded-xl border border-slate-200/80">
                    <div><strong class="text-slate-900">الصف الثاني:</strong> ${escapeHtml(t.g2_elective_rule)}</div>
                    <div><strong class="text-slate-900">الصف الثالث:</strong> ${escapeHtml(t.g3_core_subjects)}</div>
                    <div><strong class="text-teal-800">الكليات المستهدفة:</strong> ${escapeHtml(t.target_colleges)}</div>
                  </div>
                </div>
                <div class="pt-4 mt-3 border-t border-slate-200 flex gap-2">
                  <button type="button" onclick="BaccApp.openStageWithTrack('grade_2', '${t.id}')" class="flex-1 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold py-2.5 rounded-xl transition">مواد 2 ثانوي</button>
                  <button type="button" onclick="BaccApp.openStageWithTrack('grade_3', '${t.id}')" class="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-xl transition">مواد 3 ثانوي</button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </section>

      <section id="bacc-calculator-sec" class="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div class="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-teal-500/30">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div class="lg:col-span-7 space-y-4">
              <span class="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold px-3 py-1 rounded-full">أداة تفاعلية حصرية</span>
              <h2 class="text-xl sm:text-2xl font-black">حاسبة المجموع التراكمي للبكالوريا المصرية (600 درجة) وشرط الـ 60%</h2>
              <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
                أدخل درجاتك في الفرصة الأولى (مايو/يونيو) والفرصة الثانية التحسينية (يوليو/أغسطس). يقوم النظام تلقائياً باحتساب <strong>الدرجة الأعلى</strong> في كل مادة وفق القرار الوزاري!
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                ${[
                  { id: 'calc_g2_ar', label: 'اللغة العربية (2ث - أساسي)', d1: 88, d2: 94 },
                  { id: 'calc_g2_en', label: 'اللغة الأجنبية الأولى (2ث - أساسي)', d1: 85, d2: 90 },
                  { id: 'calc_g2_hi', label: 'التاريخ المصري (2ث - أساسي)', d1: 91, d2: 89 },
                  { id: 'calc_g2_sp', label: 'مادة التخصص (2ث - حسب المسار)', d1: 82, d2: 95 },
                  { id: 'calc_g3_s1', label: 'مادة التخصص الأولى مستوى رفيع (3ث)', d1: 90, d2: 96 },
                  { id: 'calc_g3_s2', label: 'مادة التخصص الثانية مستوى رفيع (3ث)', d1: 87, d2: 93 }
                ]
                  .map(
                    item => `
                  <div class="bg-white/10 rounded-xl p-3 border border-white/15">
                    <label class="block text-xs font-bold text-amber-300 mb-2">${item.label}</label>
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <span class="text-[10px] text-slate-300 block mb-1">فرصة أولى (من 100)</span>
                        <input type="number" id="${item.id}_1" min="0" max="100" value="${item.d1}" oninput="BaccApp.recalculateBaccalaureateScore()" class="w-full bg-slate-900/90 border border-slate-600 rounded-lg px-2.5 py-1.5 text-white text-xs font-bold" />
                      </div>
                      <div>
                        <span class="text-[10px] text-teal-300 block mb-1">فرصة ثانية تحسين</span>
                        <input type="number" id="${item.id}_2" min="0" max="100" value="${item.d2}" oninput="BaccApp.recalculateBaccalaureateScore()" class="w-full bg-slate-900/90 border border-teal-500/50 rounded-lg px-2.5 py-1.5 text-amber-300 text-xs font-bold" />
                      </div>
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="lg:col-span-5 bg-slate-950/80 rounded-2xl p-6 border border-white/15 space-y-5">
              <h3 class="font-black text-lg text-amber-400 border-b border-white/10 pb-3">نتيجة شهادة البكالوريا المحتسبة</h3>
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-300">المجموع التراكمي الأعلى:</span>
                <span id="calc-total-score" class="text-3xl font-black text-white">569 / 600</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-300">النسبة المئوية النهائية:</span>
                <span id="calc-total-pct" class="text-2xl font-black text-teal-400">94.83%</span>
              </div>
              <div class="bg-white/5 rounded-xl p-3.5 border border-white/10 space-y-2">
                <label class="block text-xs font-bold text-slate-200">
                  نسبة إنجاز التقييمات الأسبوعية والشهرية والمشروع (شرط 60% لدخول الامتحان):
                </label>
                <input type="range" id="calc_assessment_slider" min="0" max="100" value="85" oninput="BaccApp.recalculateBaccalaureateScore()" class="w-full accent-teal-400 cursor-pointer" />
                <div class="flex items-center justify-between text-xs">
                  <span id="calc-assessment-val" class="font-bold text-amber-300">85% من الأداءات مكتملة</span>
                  <span id="calc-assessment-status" class="bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">مؤهل لدخول الفرصة الأولى ✓</span>
                </div>
              </div>
              <p class="text-[11px] text-slate-400 leading-relaxed">
                * تُحتسب الدرجة الأعلى للطالب من بين جميع محاولاته في كل مادة، وتُرسل قاعدة البيانات الكاملة إلى مكتب تنسيق القبول بالجامعات.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="max-w-7xl mx-auto px-4 sm:px-6 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div class="lg:col-span-7 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-black text-slate-900">👨‍🏫 نخبة خبراء ومعلمي البكالوريا المصرية</h2>
            <span class="text-xs text-teal-700 font-bold">${teachers.length} خبراء معتمدين</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${teachers
              .slice(0, 4)
              .map(
                t => `
              <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-extrabold bg-teal-50 text-teal-800 px-2.5 py-1 rounded-lg">${escapeHtml(t.subject_specialty)}</span>
                  <span class="text-xs font-bold text-amber-600">⭐ ${t.rating}</span>
                </div>
                <h3 class="font-black text-base text-slate-900">${escapeHtml(t.name)}</h3>
                <p class="text-xs text-slate-500 font-semibold">${escapeHtml(t.title)}</p>
                <p class="text-xs text-slate-600">${escapeHtml(t.bio)}</p>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="lg:col-span-5 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-black text-slate-900">📰 آخر القرارات والأخبار التعليمية</h2>
            <button type="button" onclick="BaccApp.navigate('news')" class="text-xs text-teal-700 font-bold hover:underline">عرض الكل ←</button>
          </div>
          <div class="space-y-3">
            ${announcements
              .map(
                a => `
              <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1.5">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md">${escapeHtml(a.category)}</span>
                  <span class="text-slate-400">${escapeHtml(a.published_at)}</span>
                </div>
                <h3 class="font-bold text-sm text-slate-900">${escapeHtml(a.title)}</h3>
                <p class="text-xs text-slate-600 leading-relaxed">${escapeHtml(a.content)}</p>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </section>
    `;
  }

  // ============================================================================
  // STAGE INDEPENDENT VIEW
  // ============================================================================
  function renderStageView() {
    const stages = global.BaccDB.getStages();
    const stage = stages.find(s => s.id === AppState.selectedStageId) || stages[0];
    const tracks = global.BaccDB.getTracks();
    const subjects = global.BaccDB.getSubjects({
      stage_id: stage.id,
      track_id: AppState.selectedTrackFilter
    });

    return `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div class="flex flex-wrap items-center gap-2">
            ${stages
              .map(
                s => `
              <button type="button" onclick="BaccApp.openStage('${s.id}')" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition ${
                  s.id === stage.id
                    ? 'bg-slate-900 text-amber-400 shadow'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }">
                ${escapeHtml(s.name)}
              </button>
            `
              )
              .join('')}
          </div>
          <span class="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200">
            ${escapeHtml(stage.system_type)}
          </span>
        </div>

        <div class="bacc-hero-gradient text-white rounded-3xl p-6 sm:p-8 shadow-lg">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div class="space-y-2 max-w-3xl">
              <span class="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold px-3 py-1 rounded-full">${escapeHtml(stage.badge)}</span>
              <h1 class="text-2xl sm:text-3xl font-black">${escapeHtml(stage.name)} — ${escapeHtml(stage.subtitle)}</h1>
              <p class="text-xs sm:text-sm text-slate-200 leading-relaxed">${escapeHtml(stage.description)}</p>
            </div>
            <div class="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15 min-w-[210px] text-center">
              <div class="text-xs text-slate-300">إجمالي الدرجات المقررة بالمرحلة</div>
              <div class="text-3xl font-black text-amber-400 my-1">${stage.max_score} درجة</div>
              <div class="text-[11px] text-teal-300 font-bold">شرط 60% تقييمات لدخول الامتحان</div>
            </div>
          </div>
        </div>

        ${
          stage.id !== 'grade_1'
            ? `
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div class="text-xs font-bold text-slate-500">تصفية المواد الدراسية حسب المسار التخصصي بالبكالوريا المصرية:</div>
            <div class="flex flex-wrap gap-2">
              <button type="button" onclick="BaccApp.setTrackFilter('all')" class="px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                AppState.selectedTrackFilter === 'all'
                  ? 'bg-teal-700 text-white shadow'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }">جميع المواد والمسارات</button>
              ${tracks
                .map(
                  t => `
                <button type="button" onclick="BaccApp.setTrackFilter('${t.id}')" class="px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                    AppState.selectedTrackFilter === t.id
                      ? 'bg-teal-700 text-white shadow'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }">
                  ${escapeHtml(t.name)}
                </button>
              `
                )
                .join('')}
            </div>
          </div>
        `
            : ''
        }

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${subjects
            .map(sub => {
              const badgeClass =
                sub.category === 'مستوى رفيع متقدم'
                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                  : sub.category === 'تخصصية للمسار'
                  ? 'bg-blue-100 text-blue-900 border-blue-300'
                  : sub.category === 'أساسية للمجموع'
                  ? 'bg-teal-100 text-teal-900 border-teal-300'
                  : 'bg-amber-100 text-amber-900 border-amber-300';

              return `
              <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between bacc-card-hover">
                <div class="p-5 space-y-3">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${badgeClass}">
                      ${escapeHtml(sub.category)}
                    </span>
                    ${
                      sub.is_unlocked
                        ? `<span class="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">🔓 متاحة بالكامل</span>`
                        : `<span class="text-xs font-extrabold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">🔒 ${sub.price_egp} ج.م</span>`
                    }
                  </div>

                  <h3 class="text-lg font-black text-slate-900 leading-snug">${escapeHtml(sub.name)}</h3>
                  <p class="text-xs text-slate-600 leading-relaxed">${escapeHtml(sub.description)}</p>

                  <div class="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
                    <span>👨‍🏫 ${escapeHtml(sub.teacher_name)}</span>
                    <span class="font-bold text-slate-700">الدرجة: ${sub.max_grade} (النجاح ${sub.pass_grade})</span>
                  </div>

                  <div class="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span class="font-black text-slate-900 block">${sub.units_count}</span>
                      <span class="text-[10px] text-slate-500">وحدات</span>
                    </div>
                    <div>
                      <span class="font-black text-teal-700 block">${sub.lessons_count}</span>
                      <span class="text-[10px] text-slate-500">دروس ومذكرات</span>
                    </div>
                    <div>
                      <span class="font-black text-amber-600 block">${sub.exams_count}</span>
                      <span class="text-[10px] text-slate-500">امتحانات</span>
                    </div>
                  </div>
                </div>

                <div class="px-5 pb-5 pt-1 flex gap-2">
                  <button type="button" onclick="BaccApp.openSubject('${sub.id}')" class="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm transition">
                    📖 دخول المادة والدروس
                  </button>
                  ${
                    !sub.is_unlocked
                      ? `<button type="button" onclick="BaccApp.startSubjectCheckout('${sub.id}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-3.5 py-2.5 rounded-xl text-xs transition">
                          اشترك الآن
                        </button>`
                      : ''
                  }
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // ============================================================================
  // SUBJECT & LESSON VIEW
  // ============================================================================
  function renderSubjectView() {
    const details = global.BaccDB.getSubjectDetails(AppState.selectedSubjectId);
    if (!details) {
      return `<div class="p-10 text-center">المادة غير موجودة. <button type="button" onclick="BaccApp.navigate('home')" class="text-teal-700 underline">العودة للرئيسية</button></div>`;
    }

    const allLessons = details.all_lessons || [];
    let activeLesson = allLessons.find(l => l.id === AppState.selectedLessonId) || allLessons[0] || null;
    if (activeLesson && AppState.selectedLessonId !== activeLesson.id) {
      AppState.selectedLessonId = activeLesson.id;
    }

    return `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="space-y-1.5">
              <div class="flex items-center gap-2 text-xs text-slate-500">
                <button type="button" onclick="BaccApp.openStage('${details.stage_id}')" class="hover:text-teal-700 font-bold">
                  ${escapeHtml(details.stage ? details.stage.name : 'المرحلة الدراسية')}
                </button>
                <span>/</span>
                <span class="text-teal-700 font-bold">${escapeHtml(details.category)}</span>
              </div>
              <h1 class="text-xl sm:text-2xl font-black text-slate-900">${escapeHtml(details.name)}</h1>
              <p class="text-xs text-slate-600 max-w-2xl">${escapeHtml(details.description)}</p>
              <div class="flex flex-wrap items-center gap-3 pt-1 text-xs">
                <span class="font-bold text-slate-800">👨‍🏫 ${escapeHtml(details.teacher ? details.teacher.name : 'خبير المادة')}</span>
                <span class="bg-slate-100 px-2.5 py-1 rounded-lg font-bold">الدرجة النهائية: ${details.max_grade} درجة</span>
                ${
                  details.is_unlocked
                    ? `<span class="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg font-bold">✓ جميع دروس المادة مفتوحة لك</span>`
                    : `<button type="button" onclick="BaccApp.startSubjectCheckout('${details.id}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1 rounded-lg font-extrabold">🔓 اشترك في المادة (${details.price_egp} ج.م)</button>`
                }
              </div>
            </div>

            <div class="bg-slate-50 rounded-2xl p-4 border border-slate-200 min-w-[260px] space-y-2">
              <div class="flex items-center justify-between text-xs font-bold">
                <span class="text-slate-700">نسبة إنجازك في الكورس/المادة</span>
                <span class="text-teal-700 font-black">${details.progress_percent}%</span>
              </div>
              <div class="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div class="h-full bg-teal-600 transition-all duration-500" style="width: ${details.progress_percent}%"></div>
              </div>
              <div class="flex items-center justify-between text-[11px] text-slate-500">
                <span>المكتمل: ${details.completed_count} من ${allLessons.length} دروس</span>
                <span>المتبقي: ${Math.max(0, allLessons.length - details.completed_count)}</span>
              </div>
              ${
                details.resume_lesson_id
                  ? `<button type="button" onclick="BaccApp.resumeCourseFromLastPoint('${details.id}', '${details.resume_lesson_id}')" class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-1.5 px-3 rounded-xl text-xs shadow transition">
                      ⏯️ استكمال التعلم من آخر نقطة توقف
                    </button>`
                  : ''
              }
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div class="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between">
              <span class="font-bold text-sm">📚 فهرس الوحدات والدروس</span>
              <span class="text-xs text-amber-400 font-bold">${allLessons.length} دروس</span>
            </div>

            <div class="divide-y divide-slate-100">
              ${details.units
                .map(
                  unit => `
                <div class="p-3.5 space-y-2">
                  <div class="font-extrabold text-xs text-teal-900 bg-teal-50/80 px-3 py-2 rounded-xl border border-teal-200/60">
                    ${escapeHtml(unit.title)}
                  </div>
                  <div class="space-y-1.5 pr-1">
                    ${unit.lessons
                      .map(les => {
                        const isSelected = activeLesson && activeLesson.id === les.id;
                        return `
                        <button type="button" onclick="BaccApp.selectLesson('${les.id}')" class="w-full text-right p-2.5 rounded-xl border transition flex items-start justify-between gap-2 ${
                          isSelected
                            ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                            : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200/80'
                        }">
                          <div class="flex items-start gap-2">
                            <span class="mt-0.5 text-sm">${les.completed ? '✅' : les.can_view ? '▶️' : '🔒'}</span>
                            <div>
                              <div class="text-xs font-bold leading-snug">${escapeHtml(les.title)}</div>
                              <div class="text-[10px] ${isSelected ? 'text-teal-100' : 'text-slate-400'} mt-0.5">
                                ⏱️ ${les.duration_minutes} دقيقة
                                ${les.is_free_preview ? ' • مجاني' : ''}
                                ${les.quiz_score !== null ? ` • تدريب: ${les.quiz_score}%` : ''}
                              </div>
                            </div>
                          </div>
                        </button>
                      `;
                      })
                      .join('')}
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="lg:col-span-8 space-y-5">
            ${
              !activeLesson
                ? `<div class="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500">لا توجد دروس مضافة في هذه المادة حالياً.</div>`
                : !activeLesson.can_view
                ? `
                  <div class="bg-white rounded-3xl p-8 text-center border border-amber-300 shadow-sm space-y-4">
                    <div class="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-3xl mx-auto">🔒</div>
                    <h2 class="text-xl font-black text-slate-900">${escapeHtml(activeLesson.title)}</h2>
                    <p class="text-sm text-slate-600 max-w-lg mx-auto">
                      هذا الدرس متاح للطلاب المشتركين في <strong>${escapeHtml(details.name)}</strong> أو في إحدى باقات المسار الشاملة.
                    </p>
                    <div class="flex justify-center gap-3 pt-2">
                      <button type="button" onclick="BaccApp.startSubjectCheckout('${details.id}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 py-3 rounded-xl text-sm shadow">
                        💳 اشترك في المادة الآن (${details.price_egp} ج.م)
                      </button>
                      <button type="button" onclick="BaccApp.navigate('pricing')" class="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-3 rounded-xl text-sm">
                        عرض باقات المسار الشاملة
                      </button>
                    </div>
                  </div>
                `
                : renderActiveLessonWorkspace(details, activeLesson)
            }
          </div>
        </div>
      </div>
    `;
  }

  function renderActiveLessonWorkspace(subjectDetails, lesson) {
    const tabBtnClass = tKey =>
      AppState.lessonTab === tKey
        ? 'bg-teal-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-sm'
        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition';

    let tabBodyHtml = '';
    if (AppState.lessonTab === 'video') {
      tabBodyHtml = `
        <div class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-2.5 rounded-xl">
            <div class="flex items-center gap-2">
              <button type="button" onclick="BaccApp.setVideoMode('studio')" class="px-3 py-1.5 rounded-lg text-xs font-bold ${
                AppState.videoMode === 'studio' ? 'bg-slate-900 text-amber-400' : 'text-slate-700 hover:bg-white'
              }">🎬 مشغل الأكاديمية التفاعلي المدمج</button>
              <button type="button" onclick="BaccApp.setVideoMode('youtube')" class="px-3 py-1.5 rounded-lg text-xs font-bold ${
                AppState.videoMode === 'youtube' ? 'bg-slate-900 text-amber-400' : 'text-slate-700 hover:bg-white'
              }">📺 البث المرئي الخارجي (YouTube Embed)</button>
            </div>
            <span class="text-xs text-slate-600 font-bold">مدة المحاضرة: ${lesson.duration_minutes} دقيقة</span>
          </div>

          ${
            AppState.videoMode === 'studio'
              ? `
            <div class="bg-slate-950 text-white rounded-2xl overflow-hidden border-2 border-slate-800 shadow-xl">
              <div class="p-6 sm:p-8 min-h-[300px] flex flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 relative">
                <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-teal-300 border-b border-white/10 pb-3">
                  <div class="flex items-center gap-2">
                    <span class="font-bold">🎓 مشغل الشرح الصوتي والمرئي التفاعلي — Baccalaureate Academy</span>
                    ${
                      AppState.studioPlaying
                        ? `<span class="bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full text-[10px]">🔊 الشرح الصوتي يعمل الآن</span>`
                        : `<span class="bg-white/10 text-slate-300 px-2 py-0.5 rounded-full text-[10px]">اضغط تشغيل لسماع الشرح الصوتي</span>`
                    }
                  </div>
                  <div class="flex items-center gap-1.5">
                    <button type="button" onclick="BaccApp.setStudioSlide(0)" class="px-2.5 py-1 rounded-lg text-[11px] font-bold ${AppState.studioSlideIdx === 0 ? 'bg-amber-500 text-slate-950' : 'bg-white/10 text-white'}">1. المقدمة والمفاهيم</button>
                    <button type="button" onclick="BaccApp.setStudioSlide(1)" class="px-2.5 py-1 rounded-lg text-[11px] font-bold ${AppState.studioSlideIdx === 1 ? 'bg-amber-500 text-slate-950' : 'bg-white/10 text-white'}">2. القوانين والشرح</button>
                    <button type="button" onclick="BaccApp.setStudioSlide(2)" class="px-2.5 py-1 rounded-lg text-[11px] font-bold ${AppState.studioSlideIdx === 2 ? 'bg-amber-500 text-slate-950' : 'bg-white/10 text-white'}">3. خلاصة الامتحان</button>
                  </div>
                </div>

                <div class="my-5 space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="inline-block bg-teal-500/20 text-teal-300 text-xs font-bold px-3 py-1 rounded-lg">
                      ${
                        AppState.studioSlideIdx === 0
                          ? '📌 الجزء الأول: الفكرة المحورية وعناصر الدرس'
                          : AppState.studioSlideIdx === 1
                          ? '📐 الجزء الثاني: القواعد والقوانين التفصيلية'
                          : '🏆 الجزء الثالث: أهم نقاط أسئلة امتحان البكالوريا'
                      }
                    </span>
                    <button type="button" onclick="BaccApp.speakCurrentSlideNow()" class="bg-teal-600 hover:bg-teal-500 text-white font-bold px-3 py-1 rounded-lg text-xs">
                      🗣️ قراءة صوتية فورية للشريحة
                    </button>
                  </div>
                  <h3 class="text-lg sm:text-xl font-black text-white">${escapeHtml(lesson.title)}</h3>
                  <div class="text-xs sm:text-sm text-slate-100 leading-loose bg-black/40 p-4 rounded-xl border border-white/15 whitespace-pre-wrap">${
                    AppState.studioSlideIdx === 0
                      ? escapeHtml(lesson.video_summary)
                      : AppState.studioSlideIdx === 1
                      ? escapeHtml(lesson.pdf_content)
                      : escapeHtml(['خلاصة وتطبيقات الدرس:', lesson.video_summary, '', (lesson.quiz_questions && lesson.quiz_questions[0] ? 'سؤال نموذجي: ' + lesson.quiz_questions[0].q + ' — التفسير: ' + lesson.quiz_questions[0].explanation : '')].join('\n'))
                  }</div>
                </div>

                <div class="space-y-2">
                  <input type="range" min="0" max="${lesson.duration_minutes * 60}" value="${AppState.studioSeconds}" oninput="BaccApp.seekStudioVideo(this.value)" class="w-full accent-amber-400 cursor-pointer" />
                  <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <button type="button" onclick="BaccApp.toggleStudioPlay(${lesson.duration_minutes * 60})" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow">
                        ${AppState.studioPlaying ? '⏸️ إيقاف الشرح الصوتي' : '▶️ تشغيل الشرح بالصوت والصورة'}
                      </button>
                      <button type="button" onclick="BaccApp.toggleStudioMute()" class="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-2 rounded-xl text-xs">
                        ${AppState.studioMuted ? '🔇 الصوت مكتوم (اضغط للتشغيل)' : '🔊 الصوت مفعل'}
                      </button>
                      <button type="button" onclick="BaccApp.changeStudioSpeed()" class="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-2 rounded-xl text-xs">
                        السرعة (${AppState.studioSpeed}x)
                      </button>
                    </div>
                    <span id="studio-time-label" class="text-xs font-mono text-slate-300">
                      ${formatSeconds(AppState.studioSeconds)} / ${formatSeconds(lesson.duration_minutes * 60)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          `
              : lesson.video_url && (lesson.video_url.endsWith('.mp4') || lesson.video_url.endsWith('.webm'))
              ? `
            <div class="aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-300">
              <video src="${escapeHtml(lesson.video_url)}" controls class="w-full h-full"></video>
            </div>
          `
              : `
            <div class="aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-300">
              <iframe src="${escapeHtml(normalizeVideoEmbedUrl(lesson.video_url))}" title="${escapeHtml(lesson.title)}" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
          `
          }

          <div class="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 space-y-1.5">
            <h4 class="text-xs font-black text-teal-900">📌 ملخص المحاضرة والنقاط الجوهرية:</h4>
            <p class="text-xs text-slate-700 leading-relaxed">${escapeHtml(lesson.video_summary)}</p>
          </div>
        </div>
      `;
    } else if (AppState.lessonTab === 'pdf') {
      tabBodyHtml = `
        <div class="space-y-4">
          <div class="bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="text-2xl">📄</span>
              <div>
                <h4 class="font-bold text-sm">${escapeHtml(lesson.pdf_title)}</h4>
                <span class="text-[11px] text-slate-300">مذكرة رسمية منسقة وجاهزة للطباعة أو التحميل المباشر</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" onclick="BaccApp.downloadLessonPdf('${lesson.id}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs transition">
                ⬇️ تحميل المذكرة (ملف نصي/مطبوع)
              </button>
              <button type="button" onclick="window.print()" class="bg-white/15 hover:bg-white/25 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition">
                🖨️ طباعة
              </button>
            </div>
          </div>

          <div class="bg-amber-50/40 border-2 border-slate-200 rounded-2xl p-5 space-y-3">
            <div class="border-b border-slate-200 pb-2 flex items-center justify-between">
              <span class="font-black text-sm text-slate-900">📖 عارض المذكرات والملخصات المدمج</span>
              <span class="text-xs text-teal-800 font-bold">Baccalaureate Academy Notes</span>
            </div>
            <pre class="whitespace-pre-wrap font-sans text-xs sm:text-sm text-slate-800 leading-loose bg-white p-4 rounded-xl border border-slate-200">${escapeHtml(lesson.pdf_content)}</pre>
          </div>

          <div class="bg-teal-50/60 border border-teal-200 rounded-2xl p-4 space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h5 class="text-xs font-black text-teal-900">☁️ مرفقات الدرس في Supabase Storage (تنظيم حسب المرحلة/المادة/الكورس)</h5>
                <p class="text-[11px] text-slate-600">يتم تأمين ملفات الكورسات المدفوعة بروابط موقعة مؤقتة (Signed URLs).</p>
              </div>
              <button type="button" onclick="BaccApp.generateLessonSignedUrl('${lesson.id}')" class="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-3 py-1.5 rounded-xl text-xs">
                🔐 توليد رابط آمن موقّع (Signed URL)
              </button>
            </div>
            ${
              AppState.lastGeneratedSignedUrl
                ? `<div class="p-2.5 bg-white rounded-xl border border-teal-300 text-[11px] font-mono text-teal-900 break-all">${escapeHtml(AppState.lastGeneratedSignedUrl)}</div>`
                : ''
            }
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
            <label class="block text-xs font-black text-slate-800">✍️ ملاحظاتك الشخصية وتلخيصك لهذا الدرس:</label>
            <textarea id="student-lesson-notes" rows="3" placeholder="اكتب أهم القوانين أو الملاحظات التي تود تذكرها عند المراجعة..." class="w-full rounded-xl border border-slate-300 p-3 text-xs focus:outline-none focus:border-teal-600">${escapeHtml(lesson.student_notes || '')}</textarea>
            <div class="flex justify-end">
              <button type="button" onclick="BaccApp.saveLessonNotes('${lesson.id}')" class="bg-teal-700 hover:bg-teal-800 text-white font-bold px-4 py-2 rounded-xl text-xs">
                💾 حفظ ملاحظاتي في حسابي
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (AppState.lessonTab === 'quiz') {
      const questions = lesson.quiz_questions || [];
      tabBodyHtml = `
        <div class="space-y-4">
          <div class="bg-teal-900 text-white p-4 rounded-2xl flex items-center justify-between">
            <div>
              <h4 class="font-black text-sm">🧠 تدريب تفاعلي فوري بعد الدرس</h4>
              <p class="text-xs text-teal-200">أجب عن الأسئلة التالية للتأكد من استيعابك الكامل للدرس وتحديث نسبة التقييم الأسبوعي.</p>
            </div>
            <span class="bg-white/15 px-3 py-1 rounded-lg text-xs font-bold">${questions.length} أسئلة</span>
          </div>

          ${
            questions.length === 0
              ? `<div class="p-6 text-center text-slate-500 text-xs">لا توجد أسئلة تدريبية مسجلة لهذا الدرس.</div>`
              : questions
                  .map((qObj, qIdx) => {
                    const selected = AppState.quizAnswers[qIdx];
                    return `
                    <div class="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                      <div class="font-bold text-sm text-slate-900">${qIdx + 1}. ${escapeHtml(qObj.q)}</div>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${(qObj.options || [])
                          .map((opt, optIdx) => {
                            const isPicked = String(selected) === String(optIdx);
                            let btnStyle = isPicked
                              ? 'bg-teal-700 text-white border-teal-700'
                              : 'bg-white hover:bg-teal-50 text-slate-800 border-slate-200';
                            if (AppState.quizSubmitted) {
                              if (optIdx === qObj.correct) {
                                btnStyle = 'bg-emerald-600 text-white border-emerald-600';
                              } else if (isPicked && optIdx !== qObj.correct) {
                                btnStyle = 'bg-red-600 text-white border-red-600';
                              }
                            }
                            return `
                              <button type="button" onclick="BaccApp.pickLessonQuizOption(${qIdx}, ${optIdx})" class="text-right p-3 rounded-xl border text-xs font-bold transition ${btnStyle}">
                                ${escapeHtml(opt)}
                              </button>
                            `;
                          })
                          .join('')}
                      </div>
                      ${
                        AppState.quizSubmitted
                          ? `
                        <div class="p-3 rounded-xl bg-white border border-slate-200 text-xs">
                          <span class="font-black ${
                            String(selected) === String(qObj.correct) ? 'text-emerald-700' : 'text-red-700'
                          }">
                            ${String(selected) === String(qObj.correct) ? '✓ إجابة صحيحة!' : '✕ إجابة غير دقيقة'}
                          </span>
                          <p class="text-slate-600 mt-1">${escapeHtml(qObj.explanation || '')}</p>
                        </div>
                      `
                          : ''
                      }
                    </div>
                  `;
                  })
                  .join('')
          }

          ${
            questions.length > 0
              ? `
            <div class="flex items-center justify-between pt-2">
              <button type="button" onclick="BaccApp.submitLessonQuiz('${lesson.id}')" class="bg-teal-700 hover:bg-teal-800 text-white font-black px-6 py-3 rounded-xl text-xs sm:text-sm shadow">
                ✅ تصحيح التدريب وحفظ الدرجة
              </button>
              ${
                AppState.quizSubmitted
                  ? `<button type="button" onclick="BaccApp.resetLessonQuiz()" class="text-xs text-slate-600 hover:text-slate-900 font-bold underline">إعادة المحاولة</button>`
                  : ''
              }
            </div>
          `
              : ''
          }
        </div>
      `;
    } else if (AppState.lessonTab === 'exams') {
      const exams = subjectDetails.exams || [];
      tabBodyHtml = `
        <div class="space-y-3">
          ${
            exams.length === 0
              ? `<div class="p-6 text-center text-xs text-slate-500">لا توجد امتحانات مضافة لهذه المادة بعد.</div>`
              : exams
                  .map(
                    ex => `
                <div class="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span class="text-[11px] font-bold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-md">${escapeHtml(ex.exam_type)}</span>
                    <h4 class="font-black text-sm text-slate-900 mt-1">${escapeHtml(ex.title)}</h4>
                    <p class="text-xs text-slate-500">⏱️ المدة: ${ex.duration_minutes} دقيقة • الدرجة النهائية: ${ex.total_marks} درجة</p>
                  </div>
                  <button type="button" onclick="BaccApp.startExam('${ex.id}')" class="bg-slate-900 hover:bg-teal-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs">
                    📝 بدء الامتحان الآن
                  </button>
                </div>
              `
                  )
                  .join('')
          }
        </div>
      `;
    }

    return `
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-teal-700">الدرس الحالي (ترتيب #${lesson.order_index || 1})</span>
              ${
                lesson.last_position_seconds > 0
                  ? `<span class="bg-amber-100 text-amber-900 text-[11px] font-bold px-2 py-0.5 rounded-full">آخر نقطة توقف: ${formatSeconds(lesson.last_position_seconds)}</span>`
                  : ''
              }
            </div>
            <h2 class="text-lg sm:text-xl font-black text-slate-900 mt-0.5">${escapeHtml(lesson.title)}</h2>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" onclick="BaccApp.toggleLessonCompleteBtn('${lesson.id}')" class="px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
              lesson.completed
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-slate-900 hover:bg-teal-800 text-white shadow'
            }">
              <span>${lesson.completed ? '✅ مكتمل (إلغاء)' : '☑️ تحديد الدرس كمكتمل'}</span>
            </button>
            ${
              lesson.next_lesson_id
                ? `<button type="button" onclick="BaccApp.selectLesson('${lesson.next_lesson_id}')" class="bg-teal-700 hover:bg-teal-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow transition">
                    الدرس التالي ←
                  </button>`
                : ''
            }
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" onclick="BaccApp.setLessonTab('video')" class="${tabBtnClass('video')}">🎬 فيديو الشرح</button>
          <button type="button" onclick="BaccApp.setLessonTab('pdf')" class="${tabBtnClass('pdf')}">📄 مذكرة الـ PDF والملخص</button>
          <button type="button" onclick="BaccApp.setLessonTab('quiz')" class="${tabBtnClass('quiz')}">🧠 تدريب الدرس (${(lesson.quiz_questions || []).length})</button>
          <button type="button" onclick="BaccApp.setLessonTab('exams')" class="${tabBtnClass('exams')}">📝 امتحانات المادة (${(subjectDetails.exams || []).length})</button>
        </div>

        <div>${tabBodyHtml}</div>
      </div>
    `;
  }

  // ============================================================================
  // EXAMS HUB & ELECTRONIC EXAM RUNNER
  // ============================================================================
  function renderExamsHubView() {
    const stages = global.BaccDB.getStages();
    const subjects = global.BaccDB.getSubjects({ stage_id: AppState.examStageFilter });
    const exams = global.BaccDB.getExams({
      stage_id: AppState.examStageFilter,
      subject_id: AppState.examSubjectFilter
    });

    return `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div class="bacc-hero-gradient text-white rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="space-y-2 max-w-2xl">
            <span class="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold px-3 py-1 rounded-full">نظام التقييم الإلكتروني للبكالوريا</span>
            <h1 class="text-2xl sm:text-3xl font-black">بنك الامتحانات الإلكترونية والاختبارات التجريبية الشاملة</h1>
            <p class="text-xs sm:text-sm text-slate-200 leading-relaxed">
              محاكاة كاملة لامتحانات الفرصة الأولى (مايو/يونيو) والفرصة الثانية التحسينية (يوليو/أغسطس) مع أسئلة اختيار من متعدد وصواب وخطأ ومصطلح علمي، وتصحيح إلكتروني فوري مع احتساب الدرجة الأعلى للطالب.
            </p>
          </div>
          <div class="bg-white/10 rounded-2xl p-4 border border-white/15 text-center min-w-[200px]">
            <div class="text-xs text-slate-300">قاعدة احتساب المجموع</div>
            <div class="text-lg font-black text-amber-400 my-1">الدرجة الأعلى دائماً</div>
            <div class="text-[11px] text-teal-300">بين الفرصة الأولى والثانية</div>
          </div>
        </div>

        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1">تصفية حسب المرحلة الدراسية:</label>
            <select onchange="BaccApp.setExamStageFilter(this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold bg-slate-50">
              <option value="all" ${AppState.examStageFilter === 'all' ? 'selected' : ''}>جميع المراحل الدراسية</option>
              ${stages
                .map(
                  s => `<option value="${s.id}" ${AppState.examStageFilter === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
                )
                .join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1">تصفية حسب المادة الدراسية:</label>
            <select onchange="BaccApp.setExamSubjectFilter(this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold bg-slate-50">
              <option value="all" ${AppState.examSubjectFilter === 'all' ? 'selected' : ''}>جميع المواد الدراسية</option>
              ${subjects
                .map(
                  s => `<option value="${s.id}" ${AppState.examSubjectFilter === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
                )
                .join('')}
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          ${exams
            .map(
              ex => `
            <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between gap-4 bacc-card-hover">
              <div class="space-y-2.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-extrabold bg-teal-50 text-teal-900 px-2.5 py-1 rounded-lg border border-teal-200">${escapeHtml(ex.exam_type)}</span>
                  <span class="text-xs font-bold text-slate-500">${escapeHtml(ex.stage_name)}</span>
                </div>
                <h3 class="text-base sm:text-lg font-black text-slate-900">${escapeHtml(ex.title)}</h3>
                <p class="text-xs font-bold text-teal-800">📘 المادة: ${escapeHtml(ex.subject_name)}</p>

                <div class="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-center">
                  <div>
                    <span class="text-slate-400 block text-[10px]">الزمن</span>
                    <span class="font-black text-slate-800">${ex.duration_minutes} دقيقة</span>
                  </div>
                  <div>
                    <span class="text-slate-400 block text-[10px]">الدرجة الكلية</span>
                    <span class="font-black text-teal-700">${ex.total_marks} درجة</span>
                  </div>
                  <div>
                    <span class="text-slate-400 block text-[10px]">أعلى درجة لك</span>
                    <span class="font-black text-amber-600">${ex.highest_score !== null ? ex.highest_score + ' / ' + ex.total_marks : 'لم يُختبر'}</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <span class="text-xs text-slate-500">عدد المحاولات السابقة: <strong>${ex.attempts_count}</strong></span>
                ${
                  ex.can_access
                    ? `<button type="button" onclick="BaccApp.startExam('${ex.id}')" class="bg-slate-900 hover:bg-teal-800 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs transition">
                        🚀 ابدأ الاختبار الآن
                      </button>`
                    : `<button type="button" onclick="BaccApp.startSubjectCheckout('${ex.subject_id}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs transition">
                        🔒 اشترك في المادة لفتح الاختبار
                      </button>`
                }
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  function renderExamRunnerView() {
    const exams = global.BaccDB.getExams();
    const exam = exams.find(e => e.id === AppState.activeExamId);
    if (!exam) {
      return `<div class="p-10 text-center"><button type="button" onclick="BaccApp.navigate('exams')" class="text-teal-700 font-bold">العودة لبنك الامتحانات</button></div>`;
    }

    if (AppState.lastExamResult) {
      const res = AppState.lastExamResult;
      return `
        <div class="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div class="bg-white rounded-3xl p-6 sm:p-8 border-2 ${
            res.passed ? 'border-emerald-500' : 'border-red-400'
          } shadow-xl text-center space-y-4">
            <div class="text-5xl">${res.passed ? '🏆' : '📈'}</div>
            <span class="inline-block px-3 py-1 rounded-full text-xs font-extrabold ${
              res.passed ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
            }">
              ${res.passed ? 'اجتزت الاختبار بنجاح!' : 'تحتاج إلى مراجعة وإعادة المحاولة في الفرصة التحسينية'}
            </span>
            <h1 class="text-2xl font-black text-slate-900">${escapeHtml(exam.title)}</h1>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto pt-2">
              <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div class="text-xs text-slate-500">درجة هذه المحاولة (${escapeHtml(res.submission.opportunity_label)})</div>
                <div class="text-2xl font-black text-slate-900 mt-1">${res.submission.score} / ${res.submission.total_marks}</div>
              </div>
              <div class="bg-teal-50 p-4 rounded-2xl border border-teal-200">
                <div class="text-xs text-teal-800 font-bold">الدرجة الأعلى المحتسبة رسمياً</div>
                <div class="text-2xl font-black text-teal-700 mt-1">${res.highestOfficialScore} / ${res.submission.total_marks}</div>
              </div>
              <div class="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                <div class="text-xs text-amber-900">النسبة المئوية للمحاولة</div>
                <div class="text-2xl font-black text-amber-700 mt-1">${res.submission.percentage}%</div>
              </div>
            </div>
            <div class="flex flex-wrap justify-center gap-3 pt-3">
              <button type="button" onclick="BaccApp.startExam('${exam.id}', 'الفرصة الثانية التحسينية')" class="bg-teal-700 hover:bg-teal-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs">
                🔄 خوض محاولة تحسينية (احتساب الدرجة الأعلى)
              </button>
              <button type="button" onclick="BaccApp.navigate('student_dashboard')" class="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs">
                📊 عرض سجل درجاتي في لوحة الطالب
              </button>
              <button type="button" onclick="BaccApp.navigate('exams')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs">
                العودة لبنك الامتحانات
              </button>
            </div>
          </div>

          <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 class="text-lg font-black text-slate-900">📋 نموذج الإجابة التفصيلي والتفسير العلمي:</h2>
            <div class="space-y-3">
              ${res.detailedReview
                .map(
                  (item, idx) => `
                <div class="p-4 rounded-2xl border ${
                  item.isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'
                } space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-sm text-slate-900">السؤال ${idx + 1}: ${escapeHtml(item.text)}</span>
                    <span class="text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                      item.isCorrect ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                    }">${item.earned} / ${item.maxMarks} درجة</span>
                  </div>
                  <div class="text-xs text-slate-700">
                    <strong>التفسير النموذجي:</strong> ${escapeHtml(item.explanation)}
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div class="bg-slate-900 text-white rounded-2xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div>
            <span class="text-xs text-amber-400 font-bold">${escapeHtml(exam.subject_name)}</span>
            <h1 class="text-lg sm:text-xl font-black">${escapeHtml(exam.title)}</h1>
          </div>
          <div class="flex items-center gap-3">
            <select onchange="BaccApp.setExamOpportunity(this.value)" class="bg-slate-800 border border-slate-600 text-amber-300 text-xs font-bold rounded-xl px-3 py-2">
              <option value="الفرصة الأولى الأساسية" ${AppState.activeExamOpportunity === 'الفرصة الأولى الأساسية' ? 'selected' : ''}>الفرصة الأولى الأساسية (مايو/يونيو)</option>
              <option value="الفرصة الثانية التحسينية" ${AppState.activeExamOpportunity === 'الفرصة الثانية التحسينية' ? 'selected' : ''}>الفرصة الثانية التحسينية (يوليو/أغسطس)</option>
            </select>
            <div class="bg-red-600/20 border border-red-400/40 text-red-200 px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5">
              <span>⏱️</span>
              <span id="exam-timer-display">${formatSeconds(AppState.activeExamSecondsLeft)}</span>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          ${exam.questions
            .map((q, idx) => {
              const currentAns = AppState.activeExamAnswers[q.id];
              return `
              <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <span class="font-black text-sm text-slate-900">السؤال ${idx + 1}: ${escapeHtml(q.text)}</span>
                  <span class="text-xs font-bold bg-teal-50 text-teal-800 px-2.5 py-1 rounded-lg">${q.marks} درجة</span>
                </div>

                ${
                  q.type === 'mcq' || q.type === 'tf'
                    ? `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    ${(q.options || [])
                      .map((opt, oIdx) => {
                        const picked = String(currentAns) === String(oIdx);
                        return `
                        <button type="button" onclick="BaccApp.setExamAnswer('${q.id}', '${oIdx}')" class="text-right p-3.5 rounded-xl border text-xs font-bold transition ${
                          picked
                            ? 'bg-teal-700 text-white border-teal-700 shadow'
                            : 'bg-slate-50 hover:bg-teal-50 text-slate-800 border-slate-200'
                        }">
                          ${escapeHtml(opt)}
                        </button>
                      `;
                      })
                      .join('')}
                  </div>
                `
                    : `
                  <div class="pt-1">
                    <input type="text" value="${escapeHtml(currentAns || '')}" oninput="BaccApp.setExamAnswerText('${q.id}', this.value)" placeholder="اكتب الإجابة أو المصطلح العلمي هنا..." class="w-full rounded-xl border border-slate-300 p-3 text-xs font-bold focus:outline-none focus:border-teal-600" />
                  </div>
                `
                }
              </div>
            `;
            })
            .join('')}
        </div>

        <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <button type="button" onclick="BaccApp.navigate('exams')" class="text-xs text-slate-500 hover:text-slate-800 font-bold">إلغاء والعودة</button>
          <button type="button" onclick="BaccApp.finishActiveExam()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-xl text-sm shadow-lg transition">
            ✅ تسليم الامتحان والتصحيح الفوري
          </button>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // SUBSCRIPTIONS & ELECTRONIC PAYMENT GATEWAY
  // ============================================================================
  function renderPricingView() {
    const plans = global.BaccDB.getSubscriptionPlans();
    const allSubjects = global.BaccDB.getSubjects().filter(s => s.is_premium);
    const selectedPlan = plans.find(p => p.id === AppState.checkoutPlanId) || plans[2];

    return `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div class="text-center max-w-3xl mx-auto space-y-2">
          <span class="text-xs font-extrabold bg-teal-100 text-teal-900 px-3 py-1 rounded-full">باقات مرنة لجميع طلاب البكالوريا المصرية</span>
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900">خطط الاشتراكات وبوابة الدفع الإلكتروني</h1>
          <p class="text-xs sm:text-sm text-slate-600">
            اختر الباقة المناسبة لك وفعّل وصولك الفوري لجميع الشروحات والمذكرات والاختبارات التجريبية الشاملة.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          ${plans
            .map(p => {
              const isSelected = p.id === AppState.checkoutPlanId;
              return `
              <div class="bg-white rounded-3xl p-5 border-2 transition flex flex-col justify-between ${
                isSelected ? 'border-teal-600 shadow-xl ring-2 ring-teal-500/20' : 'border-slate-200 shadow-sm'
              }">
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">${escapeHtml(p.badge || 'باقة معتمدة')}</span>
                    ${isSelected ? '<span class="text-teal-700 font-black text-xs">✓ محددة</span>' : ''}
                  </div>
                  <h3 class="text-lg font-black text-slate-900">${escapeHtml(p.name)}</h3>
                  <div class="pt-1">
                    <span class="text-3xl font-black text-teal-700">${p.price_egp}</span>
                    <span class="text-xs font-bold text-slate-500"> ج.م / ${escapeHtml(p.billing_cycle)}</span>
                  </div>
                  <ul class="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
                    ${(p.features || [])
                      .map(
                        f => `<li class="flex items-start gap-1.5"><span class="text-teal-600 font-black">✓</span><span>${escapeHtml(f)}</span></li>`
                      )
                      .join('')}
                  </ul>
                </div>

                <button type="button" onclick="BaccApp.selectCheckoutPlan('${p.id}')" class="mt-5 w-full py-2.5 rounded-xl text-xs font-extrabold transition ${
                  isSelected ? 'bg-teal-700 text-white' : 'bg-slate-900 hover:bg-teal-800 text-white'
                }">
                  ${p.price_egp === 0 ? 'باقة مجانية مفعلة' : 'اختيار هذه الباقة للدفع'}
                </button>
              </div>
            `;
            })
            .join('')}
        </div>

        <div id="checkout-payment-box" class="bg-white rounded-3xl border-2 border-emerald-500/40 shadow-xl p-6 sm:p-8 max-w-4xl mx-auto">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 mb-5">
            <div>
              <h2 class="text-xl font-black text-slate-900">📲 تفعيل الاشتراك المباشر عبر واتساب الإدارة (moaz.elokly@)</h2>
              <p class="text-xs text-slate-600">اختر الباقة أو المادة واضغط على زر الاشتراك ليتم تحويلك مباشرة إلى حساب واتساب م. معاذ العقلي (<strong>moaz.elokly@</strong>) لتفعيل حسابك وتحديد مدة اشتراكك.</p>
            </div>
            <span class="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-extrabold px-3 py-1 rounded-full">💬 تواصل مباشر: moaz.elokly@</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">الباقة المطلوبة:</label>
                <select onchange="BaccApp.selectCheckoutPlan(this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold bg-slate-50">
                  ${plans
                    .filter(p => p.price_egp > 0)
                    .map(
                      p => `<option value="${p.id}" ${p.id === AppState.checkoutPlanId ? 'selected' : ''}>${escapeHtml(p.name)} (${p.price_egp} ج.م)</option>`
                    )
                    .join('')}
                </select>
              </div>

              ${
                AppState.checkoutPlanId === 'plan_subject'
                  ? `
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">اختر المادة المراد تفعيلها:</label>
                  <select onchange="BaccApp.setCheckoutSubject(this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold bg-slate-50">
                    ${allSubjects
                      .map(
                        s => `<option value="${s.id}" ${s.id === AppState.checkoutSubjectId ? 'selected' : ''}>${escapeHtml(s.name)} (${s.price_egp} ج.م)</option>`
                      )
                      .join('')}
                  </select>
                </div>
              `
                  : ''
              }

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">رقم هاتفك (واتساب / اتصال) لتسجيل الطلب عند الإدارة:</label>
                <input type="text" id="checkout-ref-input" placeholder="مثال: 01012345678" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold bg-white" />
              </div>
            </div>

            <div class="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-200 space-y-4 flex flex-col justify-between">
              <div class="space-y-2">
                <div class="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>حساب التواصل المباشر للإدارة:</span>
                  <span class="font-mono font-black text-emerald-900 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">moaz.elokly@</span>
                </div>
                <div class="flex items-center justify-between text-sm font-bold border-t border-emerald-200 pt-3">
                  <span>قيمة الاشتراك المحددة:</span>
                  <span class="text-2xl font-black text-teal-800">${selectedPlan.price_egp} ج.م</span>
                </div>
                <p class="text-[11px] text-slate-600 leading-relaxed">
                  بمجرد الضغط بالأسفل سيتم إرسال تفاصيل اشتراكك مباشرة إلى <strong>moaz.elokly@</strong> على واتساب ليقوم المدير بتفعيل حسابك وتحديد مدة الاشتراك من لوحة التحكم.
                </p>
              </div>
              <button type="button" onclick="BaccApp.completeSubscriptionCheckout()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl text-sm shadow-lg transition flex items-center justify-center gap-2">
                <span>📲 اشترك الآن وتواصل عبر واتساب (moaz.elokly@)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // NEWS & OFFICIAL ANNOUNCEMENTS VIEW
  // ============================================================================
  function renderNewsView() {
    const list = global.BaccDB.getAnnouncements();
    return `
      <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div class="bacc-hero-gradient text-white rounded-3xl p-6 sm:p-8 shadow-lg">
          <span class="bg-amber-500/20 text-amber-300 text-xs font-extrabold px-3 py-1 rounded-full">النشرة الرسمية</span>
          <h1 class="text-2xl sm:text-3xl font-black mt-2">الإعلانات والأخبار التعليمية لنظام البكالوريا المصرية</h1>
          <p class="text-xs sm:text-sm text-slate-200 mt-1">متابعة دورية للقرارات الوزارية ومواعيد التقييمات الأسبوعية والشهرية وامتحانات الفرصتين.</p>
        </div>

        <div class="space-y-4">
          ${list
            .map(
              a => `
            <article class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-2">
                  <span class="bg-teal-100 text-teal-900 font-extrabold px-3 py-1 rounded-full">${escapeHtml(a.category)}</span>
                  ${a.is_pinned ? '<span class="bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full">📌 مثبت</span>' : ''}
                </div>
                <span class="text-slate-400 font-bold">تاريخ النشر: ${escapeHtml(a.published_at)}</span>
              </div>
              <h2 class="text-lg font-black text-slate-900">${escapeHtml(a.title)}</h2>
              <p class="text-xs sm:text-sm text-slate-700 leading-relaxed">${escapeHtml(a.content)}</p>
              <div class="pt-2 text-[11px] text-teal-800 font-bold">المصدر: ${escapeHtml(a.official_source_label || 'إدارة الأكاديمية')}</div>
            </article>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  // ============================================================================
  // STUDENT DASHBOARD
  // ============================================================================
  function renderStudentDashboardView() {
    let data;
    try {
      data = global.BaccDB.getStudentDashboardData();
    } catch (e) {
      return `
        <div class="max-w-xl mx-auto my-12 bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-4">
          <div class="text-4xl">🔐</div>
          <h2 class="text-xl font-black">يرجى تسجيل الدخول لعرض لوحة تحكم الطالب</h2>
          <button type="button" onclick="BaccApp.openAuthModal('student_login')" class="bg-teal-700 text-white font-bold px-6 py-3 rounded-xl text-sm">تسجيل الدخول الآن</button>
        </div>
      `;
    }

    const stages = global.BaccDB.getStages();
    const tracks = global.BaccDB.getTracks();

    return `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div class="bacc-hero-gradient text-white rounded-3xl p-6 sm:p-8 shadow-lg grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div class="lg:col-span-8 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="bg-amber-500 text-slate-950 text-xs font-black px-3 py-1 rounded-full">لوحة تحكم الطالب</span>
              <span class="bg-white/15 text-white text-xs font-bold px-3 py-1 rounded-full">${escapeHtml(data.stage.name)}</span>
              <span class="bg-teal-500/30 text-teal-200 text-xs font-bold px-3 py-1 rounded-full">${escapeHtml(data.track.name)}</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black">مرحباً بك، ${escapeHtml(data.user.full_name)} 👋</h1>
            <p class="text-xs sm:text-sm text-slate-200">
              البريد الأكاديمي: ${escapeHtml(data.user.email)} • المحافظة: ${escapeHtml(data.user.governorate || 'القاهرة')}
            </p>
          </div>
          <div class="lg:col-span-4 grid grid-cols-2 gap-3 text-center">
            <div class="bg-white/10 rounded-2xl p-3.5 border border-white/15">
              <div class="text-xs text-slate-300">نسبة تقدمك بالمرحلة</div>
              <div class="text-2xl font-black text-amber-400 mt-1">${data.overall_progress}%</div>
              <div class="text-[10px] text-slate-300">${data.completed_lessons_total} من ${data.total_lessons_stage} درس</div>
            </div>
            <div class="bg-white/10 rounded-2xl p-3.5 border border-white/15">
              <div class="text-xs text-slate-300">إنجاز الأداءات (شرط 60%)</div>
              <div class="text-2xl font-black text-emerald-400 mt-1">${data.user.assessment_completion || 75}%</div>
              <div class="text-[10px] text-emerald-300">مؤهل لدخول الامتحان ✓</div>
            </div>
          </div>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-end justify-between gap-4">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1">المرحلة الدراسية الحالية:</label>
              <select id="stu-dash-grade" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">
                ${stages
                  .map(s => `<option value="${s.id}" ${s.id === data.user.grade_id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`)
                  .join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1">المسار التخصصي بالبكالوريا:</label>
              <select id="stu-dash-track" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">
                ${tracks
                  .map(t => `<option value="${t.id}" ${t.id === data.user.track_id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`)
                  .join('')}
              </select>
            </div>
            <div class="flex items-end">
              <button type="button" onclick="BaccApp.saveStudentStageTrack()" class="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-2.5 rounded-xl text-xs">
                💾 تحديث مرحلتي ومساري الدراسي
              </button>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <h2 class="text-lg font-black text-slate-900">📚 موادي الدراسية المقررة ونسبة الإنجاز:</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${data.subjects
              .map(
                s => `
              <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                <div>
                  <div class="flex items-center justify-between text-xs mb-1">
                    <span class="font-bold text-teal-800">${escapeHtml(s.category)}</span>
                    <span class="font-black text-slate-900">${s.progress_pct}%</span>
                  </div>
                  <h3 class="font-black text-sm text-slate-900">${escapeHtml(s.name)}</h3>
                  <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden my-2">
                    <div class="h-full bg-teal-600" style="width: ${s.progress_pct}%"></div>
                  </div>
                  <div class="flex items-center justify-between text-[11px] text-slate-500">
                    <span>الدروس المكتملة: ${s.completed_lessons} / ${s.lessons_count}</span>
                    <span>أعلى درجة امتحان: ${s.best_exam ? s.best_exam.score + '/100' : '—'}</span>
                  </div>
                </div>
                <button type="button" onclick="BaccApp.openSubject('${s.id}')" class="w-full bg-slate-900 hover:bg-teal-800 text-white font-bold py-2 rounded-xl text-xs">
                  متابعة المذاكرة والدروس ←
                </button>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 class="font-black text-base text-slate-900">📝 سجل امتحاناتي ودرجات الفرصتين:</h3>
            ${
              data.submissions.length === 0
                ? `<p class="text-xs text-slate-500 py-4">لم تقم بأداء اختبارات بعد. ابدأ الآن من بنك الامتحانات الشاملة.</p>`
                : `
              <div class="overflow-x-auto">
                <table class="w-full text-xs text-right">
                  <thead>
                    <tr class="border-b border-slate-200 text-slate-500">
                      <th class="py-2">الاختبار</th>
                      <th class="py-2">الفرصة</th>
                      <th class="py-2">الدرجة</th>
                      <th class="py-2">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    ${data.submissions
                      .map(
                        subm => `
                      <tr>
                        <td class="py-2.5 font-bold text-slate-900">${escapeHtml(subm.exam_title)}</td>
                        <td class="py-2.5 text-teal-800 font-semibold">${escapeHtml(subm.opportunity_label || 'فرصة أولى')}</td>
                        <td class="py-2.5 font-black text-emerald-700">${subm.score} / ${subm.total_marks} (${subm.percentage}%)</td>
                        <td class="py-2.5 text-slate-400">${escapeHtml(subm.submitted_at)}</td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
            }
          </div>

          <div class="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="font-black text-base text-slate-900">💳 اشتراكاتي الفعالة:</h3>
              <button type="button" onclick="BaccApp.navigate('pricing')" class="text-xs text-teal-700 font-bold hover:underline">+ ترقية الباقة</button>
            </div>
            <div class="space-y-2.5">
              ${
                data.subscriptions.length === 0
                  ? `<div class="p-4 rounded-xl bg-slate-50 text-xs text-slate-600">أنت حالياً على الباقة التأسيسية المجانية.</div>`
                  : data.subscriptions
                      .map(
                        sc => `
                    <div class="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 flex items-center justify-between">
                      <div>
                        <div class="font-black text-xs text-slate-900">${escapeHtml(sc.plan_name)}</div>
                        <div class="text-[11px] text-slate-600">${escapeHtml(sc.subject_name)} • ${escapeHtml(sc.transaction_ref)}</div>
                      </div>
                      <span class="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">نشط</span>
                    </div>
                  `
                      )
                      .join('')
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // ADMIN DASHBOARD (Protected by RLS for Admin only)
  // ============================================================================
  function renderAdminDashboardView() {
    let adminData;
    try {
      adminData = global.BaccDB.adminGetCompleteDashboard();
    } catch (err) {
      return `
        <div class="max-w-xl mx-auto my-12 bg-white p-8 rounded-3xl border-2 border-red-300 text-center space-y-4 shadow-lg">
          <div class="text-4xl">🛡️</div>
          <h2 class="text-xl font-black text-red-800">منطقة محمية بصلاحيات قاعدة البيانات (Admin RLS)</h2>
          <p class="text-xs text-slate-600">${escapeHtml(err.message)}</p>
          <button type="button" onclick="BaccApp.openAuthModal('admin_login')" class="bg-slate-900 text-amber-400 font-bold px-6 py-3 rounded-xl text-xs">تسجيل دخول المدير (Admin)</button>
        </div>
      `;
    }

    const tabBtn = (id, label, icon) => `
      <button type="button" onclick="BaccApp.setAdminTab('${id}')" class="px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
        AppState.adminTab === id
          ? 'bg-slate-900 text-amber-400 shadow-md'
          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
      }">
        <span>${icon}</span>
        <span>${label}</span>
      </button>
    `;

    let sectionHtml = '';
    if (AppState.adminTab === 'overview') {
      sectionHtml = `
        <div class="space-y-6">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span class="text-xs text-slate-500">إجمالي الأرباح المحصلة</span>
              <div class="text-2xl font-black text-emerald-700 mt-1">${adminData.stats.total_revenue_egp} ج.م</div>
              <span class="text-[11px] text-emerald-600 font-bold">${adminData.stats.active_subscriptions} اشتراك مدفوع نشط</span>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span class="text-xs text-slate-500">الطلاب والمدرسون</span>
              <div class="text-2xl font-black text-slate-900 mt-1">${adminData.stats.students_count} طالب</div>
              <span class="text-[11px] text-teal-700 font-bold">${adminData.stats.teachers_count} معلمين خبراء</span>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span class="text-xs text-slate-500">المواد والدروس التفاعلية</span>
              <div class="text-2xl font-black text-teal-700 mt-1">${adminData.stats.subjects_count} مادة</div>
              <span class="text-[11px] text-slate-500 font-bold">${adminData.stats.lessons_count} درس ومذكرة PDF</span>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span class="text-xs text-slate-500">الامتحانات وحماية RLS</span>
              <div class="text-2xl font-black text-amber-600 mt-1">${adminData.stats.exams_count} اختبارات</div>
              <span class="text-[11px] text-emerald-700 font-bold">✓ سياسات RLS مفعلة 100%</span>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 class="font-black text-sm text-slate-900 mb-3">📊 توزيع الطلاب على مسارات البكالوريا الأربعة</h3>
              <div class="relative h-72">
                <canvas id="adminTrackChart"></canvas>
              </div>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 class="font-black text-sm text-slate-900 mb-3">💰 تحليل الإيرادات والاشتراكات حسب الباقات (ج.م)</h3>
              <div class="relative h-72">
                <canvas id="adminRevenueChart"></canvas>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (AppState.adminTab === 'users') {
      sectionHtml = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 class="font-black text-base text-slate-900">➕ إضافة / تحديث حساب طالب أو مستخدم</h3>
            <input type="text" id="adm-usr-name" placeholder="الاسم الثلاثي" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
            <input type="email" id="adm-usr-email" placeholder="البريد الإلكتروني" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
            <input type="password" id="adm-usr-pass" placeholder="كلمة المرور (تُشفر بـ SHA-256)" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
            <div class="grid grid-cols-2 gap-2">
              <select id="adm-usr-grade" class="rounded-xl border border-slate-300 p-2 text-xs font-bold">
                ${adminData.stages.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
              </select>
              <select id="adm-usr-track" class="rounded-xl border border-slate-300 p-2 text-xs font-bold">
                ${adminData.tracks.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
              </select>
            </div>
            <button type="button" onclick="BaccApp.adminSaveUser()" class="w-full bg-teal-700 hover:bg-teal-800 text-white font-black py-2.5 rounded-xl text-xs">
              حفظ المستخدم في قاعدة البيانات
            </button>

            <div class="border-t border-slate-200 pt-3 mt-3 space-y-3">
              <h3 class="font-black text-base text-slate-900">👨‍🏫 إضافة مدرس جديد للمنصة</h3>
              <input type="text" id="adm-tch-name" placeholder="اسم المدرس واللقب العلمي" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
              <input type="text" id="adm-tch-spec" placeholder="التخصص (مثال: الفيزياء المتقدمة)" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
              <input type="text" id="adm-tch-bio" placeholder="نبذة مختصرة عن الخبرة" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
              <button type="button" onclick="BaccApp.adminSaveTeacher()" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2.5 rounded-xl text-xs">
                إضافة المدرس لهيئة التدريس
              </button>
            </div>
          </div>

          <div class="lg:col-span-8 space-y-6">
            <div class="bg-amber-50/70 p-5 rounded-2xl border-2 border-amber-300 shadow-sm space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="font-black text-base text-amber-950">⏳ المدرسون المنتظرون لموافقة الإدارة (${adminData.pendingTeachers.length})</h3>
                <span class="bg-amber-200 text-amber-950 text-xs font-extrabold px-2.5 py-1 rounded-full">مراجعة الصلاحيات</span>
              </div>
              ${
                adminData.pendingTeachers.length === 0
                  ? `<p class="text-xs text-slate-600">لا توجد طلبات مدرسين معلقة حالياً؛ جميع المدرسين الحاليين تمت مراجعتهم.</p>`
                  : `<div class="space-y-2">
                      ${adminData.pendingTeachers
                        .map(
                          pt => `
                        <div class="p-3 bg-white rounded-xl border border-amber-200 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div class="font-black text-xs text-slate-900">${escapeHtml(pt.full_name)} (${escapeHtml(pt.email)})</div>
                            <div class="text-[11px] text-teal-800 font-bold">التخصص: ${escapeHtml(pt.specialty || 'مواد البكالوريا')} • الحالة: قيد المراجعة</div>
                          </div>
                          <div class="flex items-center gap-2">
                            <button type="button" onclick="BaccApp.adminHandleTeacherReview('${pt.id}', 'approved')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs">✅ قبول واعتماد المدرس</button>
                            <button type="button" onclick="BaccApp.adminHandleTeacherReview('${pt.id}', 'rejected')" class="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs">✕ رفض</button>
                          </div>
                        </div>
                      `
                        )
                        .join('')}
                    </div>`
              }
            </div>

            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 class="font-black text-base text-slate-900">👨‍🎓 قائمة الطلاب والمستخدمين المسجلين (${adminData.all_users.length})</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-xs text-right">
                  <thead>
                    <tr class="border-b border-slate-200 text-slate-500">
                      <th class="py-2">الاسم</th>
                      <th class="py-2">البريد</th>
                      <th class="py-2">الدور</th>
                      <th class="py-2">الحالة</th>
                      <th class="py-2">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    ${adminData.all_users
                      .map(
                        u => `
                      <tr>
                        <td class="py-2.5 font-bold">${escapeHtml(u.full_name)}</td>
                        <td class="py-2.5 text-slate-600">${escapeHtml(u.email)}</td>
                        <td class="py-2.5">
                          <span class="px-2 py-0.5 rounded font-bold ${
                            u.role === 'admin' ? 'bg-amber-100 text-amber-900' : 'bg-teal-50 text-teal-800'
                          }">${u.role === 'admin' ? 'مدير Admin' : 'طالب'}</span>
                        </td>
                        <td class="py-2.5">
                          <span class="px-2 py-0.5 rounded font-bold ${
                            u.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }">${u.status === 'active' ? 'نشط' : 'موقوف'}</span>
                        </td>
                        <td class="py-2.5 flex items-center gap-1.5">
                          ${
                            u.role !== 'admin'
                              ? `
                            <button type="button" onclick="BaccApp.adminToggleUser('${u.id}')" class="bg-amber-100 hover:bg-amber-200 text-amber-900 px-2.5 py-1 rounded-lg font-bold">إيقاف/تفعيل</button>
                            <button type="button" onclick="BaccApp.adminRemoveUser('${u.id}')" class="bg-red-100 hover:bg-red-200 text-red-800 px-2.5 py-1 rounded-lg font-bold">حذف</button>
                          `
                              : '<span class="text-[11px] text-slate-400">حساب سيادي</span>'
                          }
                        </td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 class="font-black text-base text-slate-900">👨‍🏫 هيئة التدريس (${adminData.teachers.length})</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${adminData.teachers
                  .map(
                    t => `
                  <div class="p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div class="font-bold text-xs text-slate-900">${escapeHtml(t.name)}</div>
                      <div class="text-[11px] text-teal-700">${escapeHtml(t.subject_specialty)}</div>
                    </div>
                    <button type="button" onclick="BaccApp.adminRemoveTeacher('${t.id}')" class="text-xs text-red-600 hover:underline font-bold">حذف</button>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (AppState.adminTab === 'stages_subjects') {
      sectionHtml = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 class="font-black text-base text-slate-900">➕ إضافة / تعديل مادة دراسية</h3>
            <input type="text" id="adm-sub-name" placeholder="اسم المادة الدراسية" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
            <select id="adm-sub-stage" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold">
              ${adminData.stages.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
            </select>
            <select id="adm-sub-track" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold">
              ${adminData.tracks.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
            </select>
            <select id="adm-sub-cat" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold">
              <option value="أساسية للمجموع">أساسية للمجموع (100 درجة)</option>
              <option value="تخصصية للمسار">تخصصية للمسار (100 درجة)</option>
              <option value="مستوى رفيع متقدم">مستوى رفيع متقدم (100 درجة)</option>
              <option value="نجاح ورسوب (خارج المجموع)">نجاح ورسوب (خارج المجموع)</option>
            </select>
            <select id="adm-sub-teacher" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold">
              ${adminData.teachers.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
            </select>
            <input type="number" id="adm-sub-price" placeholder="سعر الاشتراك بالجنيه (0 = مجانية)" value="0" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
            <textarea id="adm-sub-desc" rows="2" placeholder="وصف المادة ومحتواها الرسمي..." class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold"></textarea>
            <button type="button" onclick="BaccApp.adminSaveSubject()" class="w-full bg-teal-700 hover:bg-teal-800 text-white font-black py-2.5 rounded-xl text-xs">
              حفظ المادة في المرحلة
            </button>
          </div>

          <div class="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 class="font-black text-base text-slate-900">📚 جميع المواد المقررة بالمراحل الثلاث (${adminData.subjects.length})</h3>
            <div class="overflow-x-auto max-h-[500px] bacc-scrollbar">
              <table class="w-full text-xs text-right">
                <thead>
                  <tr class="border-b border-slate-200 text-slate-500">
                    <th class="py-2">المادة</th>
                    <th class="py-2">المرحلة</th>
                    <th class="py-2">الفئة</th>
                    <th class="py-2">السعر</th>
                    <th class="py-2">إجراء</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${adminData.subjects
                    .map(
                      s => `
                    <tr>
                      <td class="py-2.5 font-bold text-slate-900">${escapeHtml(s.name)}</td>
                      <td class="py-2.5 text-slate-600">${escapeHtml(s.stage_id)}</td>
                      <td class="py-2.5 text-teal-800 font-semibold">${escapeHtml(s.category)}</td>
                      <td class="py-2.5 font-bold">${s.price_egp === 0 ? 'مجاني' : s.price_egp + ' ج.م'}</td>
                      <td class="py-2.5">
                        <button type="button" onclick="BaccApp.adminRemoveSubject('${s.id}')" class="bg-red-50 hover:bg-red-100 text-red-700 px-2.5 py-1 rounded-lg font-bold">حذف</button>
                      </td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } else if (AppState.adminTab === 'lessons_exams') {
      sectionHtml = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 class="font-black text-base text-slate-900">🎬 إضافة درس جديد (فيديو + مذكرة PDF + إشعار تلقائي)</h3>
            <select id="adm-les-subject" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold">
              ${adminData.subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
            </select>
            <input type="text" id="adm-les-title" placeholder="عنوان الدرس (مثال: الدرس الثالث: القوة المغناطيسية)" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
            <input type="text" id="adm-les-video" placeholder="رابط الفيديو (YouTube Embed URL)" value="https://www.youtube.com/embed/J9w-N3xS2sI" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
            <input type="text" id="adm-les-pdf-title" placeholder="اسم ملف الـ PDF (مثال: مذكرة القوة المغناطيسية.pdf)" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
            <textarea id="adm-les-pdf-content" rows="3" placeholder="محتوى الملخص ومذكرة الـ PDF والقوانين..." class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold"></textarea>
            <label class="flex items-center gap-2 text-xs font-bold text-slate-700">
              <input type="checkbox" id="adm-les-free" checked />
              <span>إتاحة هذا الدرس كمعاينة مجانية لجميع الطلاب</span>
            </label>
            <button type="button" onclick="BaccApp.adminSaveLesson()" class="w-full bg-teal-700 hover:bg-teal-800 text-white font-black py-2.5 rounded-xl text-xs">
              نشر الدرس وإرسال إشعار للطلاب
            </button>
          </div>

          <div class="lg:col-span-6 space-y-6">
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 class="font-black text-base text-slate-900">📝 إنشاء امتحان إلكتروني جديد للمادة</h3>
              <select id="adm-ex-subject" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold">
                ${adminData.subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
              </select>
              <input type="text" id="adm-ex-title" placeholder="عنوان الاختبار (مثال: اختبار شهر نوفمبر الشامل)" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
              <select id="adm-ex-type" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold">
                <option value="اختبار تجريبي شامل - فرصة أولى">اختبار تجريبي شامل - فرصة أولى (مايو/يونيو)</option>
                <option value="اختبار تجريبي شامل - فرصة ثانية تحسين">اختبار تجريبي شامل - فرصة ثانية تحسين (يوليو/أغسطس)</option>
                <option value="امتحان مادة">امتحان مادة دوري</option>
              </select>
              <input type="text" id="adm-ex-q1" placeholder="نص السؤال الأول (اختيار من متعدد)" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
              <button type="button" onclick="BaccApp.adminSaveExam()" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2.5 rounded-xl text-xs">
                اعتماد الاختبار وإخطار الطلاب
              </button>
            </div>

            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 class="font-black text-base text-slate-900">🔍 مراجعة الدروس وترتيبها واعتماد محتوى المدرسين (${adminData.lessons.length})</h3>
              <div class="max-h-64 overflow-y-auto divide-y divide-slate-100 bacc-scrollbar text-xs">
                ${adminData.lessons
                  .map(
                    l => `
                  <div class="py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span class="font-bold text-slate-900">#${l.order_index} - ${escapeHtml(l.title)}</span>
                      <span class="mr-2 px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.review_status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : l.review_status === 'pending'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-red-100 text-red-800'
                      }">${escapeHtml(l.review_status || 'approved')}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <button type="button" onclick="BaccApp.adminReorderLessonBtn('${l.id}', 'up')" class="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded font-bold" title="تحريك لأعلى">↑</button>
                      <button type="button" onclick="BaccApp.adminReorderLessonBtn('${l.id}', 'down')" class="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded font-bold" title="تحريك لأسفل">↓</button>
                      <button type="button" onclick="BaccApp.adminReviewLessonBtn('${l.id}', 'approved')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold">اعتماد</button>
                      <button type="button" onclick="BaccApp.adminReviewLessonBtn('${l.id}', 'hidden')" class="bg-amber-50 hover:bg-amber-100 text-amber-900 px-2 py-1 rounded font-bold">إخفاء</button>
                      <button type="button" onclick="BaccApp.adminDeleteLessonBtn('${l.id}')" class="bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1 rounded font-bold">حذف</button>
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 class="font-black text-base text-slate-900">📰 نشر خبر أو إعلان رسمي جديد</h3>
              <input type="text" id="adm-ann-title" placeholder="عنوان الخبر أو القرار التعليمي" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
              <textarea id="adm-ann-content" rows="2" placeholder="تفاصيل الإعلان..." class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold"></textarea>
              <button type="button" onclick="BaccApp.adminSaveAnnouncement()" class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs">
                نشر في صفحة الأخبار والإشعارات
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (AppState.adminTab === 'subscriptions') {
      const waCfg = global.BaccDB.getWhatsAppConfig();
      sectionHtml = `
        <div class="space-y-6">
          <!-- Student Subscription & Duration Control Panel -->
          <div class="bg-white p-6 rounded-3xl border-2 border-teal-600/30 shadow-md space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 class="font-black text-lg text-slate-900">⏱️ لوحة تفعيل اشتراكات الطلاب وتحديد مدة الاشتراك وإيقاف المنصة</h3>
                <p class="text-xs text-slate-500">اختر الطالب والباقة وحدد عدد أيام الاشتراك أو تاريخ الانتهاء. عند انتهاء المدة تتوقف المنصة تلقائياً عند الطالب حتى تقوم بالتجديد له.</p>
              </div>
              <span class="bg-teal-100 text-teal-900 text-xs font-extrabold px-3 py-1 rounded-full">إجمالي الطلاب المسجلين: ${adminData.students.length}</span>
            </div>

            ${
              adminData.students.length === 0
                ? `
              <div class="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <p class="text-xs font-bold text-slate-700">لا يوجد طلاب مسجلون حالياً (تم إزالة جميع الحسابات الوهمية كما طلبت).</p>
                <p class="text-xs text-slate-500">بمجرد تسجيل أي طالب جديد في المنصة أو إضافته من تبويب (الطلاب والمدرسين)، سيظهر هنا فوراً لتفعيل اشتراكه وتحديد مدته.</p>
              </div>
            `
                : `
              <div class="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">اختر الطالب:</label>
                  <select id="adm-grant-student" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold bg-white">
                    ${adminData.students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name)} (${escapeHtml(s.email)})</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">الباقة المراد تفعيلها:</label>
                  <select id="adm-grant-plan" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold bg-white">
                    ${adminData.plans.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${p.price_egp} ج.م)</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">مدة الاشتراك (بالأيام):</label>
                  <select id="adm-grant-days" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold bg-white">
                    <option value="7">7 أيام (أسبوع)</option>
                    <option value="15">15 يوماً (نصف شهر)</option>
                    <option value="30" selected>30 يوماً (شهر كامل)</option>
                    <option value="90">90 يوماً (3 أشهر)</option>
                    <option value="120">120 يوماً (ترم دراسي)</option>
                    <option value="365">365 يوماً (سنة دراسية كاملة)</option>
                  </select>
                </div>
                <div class="flex items-end">
                  <button type="button" onclick="BaccApp.adminGrantPlan()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-4 rounded-xl text-xs shadow">
                    ✅ تفعيل الاشتراك بالمدة المحددة
                  </button>
                </div>
              </div>

              <!-- Full Students Subscription Status Table -->
              <div class="overflow-x-auto">
                <table class="w-full text-xs text-right">
                  <thead>
                    <tr class="border-b border-slate-200 text-slate-500">
                      <th class="py-2">اسم الطالب والبريد</th>
                      <th class="py-2">المرحلة</th>
                      <th class="py-2">الباقة الحالية</th>
                      <th class="py-2">حالة الاشتراك وتاريخ الانتهاء</th>
                      <th class="py-2">تحكم فوري في اشتراك الطالب</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    ${adminData.students
                      .map(stu => {
                        const isExp = stu.subscription_status === 'expired' || (stu.subscription_expires_at && new Date(stu.subscription_expires_at).getTime() <= Date.now());
                        const expLabel = stu.subscription_expires_at ? stu.subscription_expires_at.substring(0, 10) : 'غير محدد';
                        return `
                        <tr>
                          <td class="py-3 font-bold text-slate-900">
                            <div>${escapeHtml(stu.full_name)}</div>
                            <div class="text-[11px] text-slate-500">${escapeHtml(stu.email)}</div>
                          </td>
                          <td class="py-3 text-slate-700 font-semibold">${escapeHtml(stu.stage_id)}</td>
                          <td class="py-3 text-teal-800 font-bold">${escapeHtml(stu.subscription_plan || 'plan_free')}</td>
                          <td class="py-3">
                            <span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                              isExp ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                            }">
                              ${isExp ? '⛔ منتهي (المنصة متوقفة لدى الطالب)' : '✅ نشط حتى: ' + escapeHtml(expLabel)}
                            </span>
                          </td>
                          <td class="py-3 flex flex-wrap items-center gap-1.5">
                            <button type="button" onclick="BaccApp.adminQuickActivateStudent('${stu.id}', 30)" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-bold">+ تفعيل 30 يوم</button>
                            <button type="button" onclick="BaccApp.adminQuickActivateStudent('${stu.id}', 120)" class="bg-teal-700 hover:bg-teal-800 text-white px-2.5 py-1 rounded-lg font-bold">+ تفعيل ترم (120 يوم)</button>
                            <button type="button" onclick="BaccApp.adminStopStudentSub('${stu.id}')" class="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg font-bold">⛔ إنهاء وإيقاف المنصة</button>
                          </td>
                        </tr>
                      `;
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
            }
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div class="lg:col-span-5 space-y-4">
              <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h3 class="font-black text-base text-slate-900">📲 إعداد حساب واتساب الاشتراك (moaz.elokly@)</h3>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">معرف حساب التواصل / واتساب:</label>
                  <input type="text" id="adm-wa-handle" value="${escapeHtml(waCfg.handle)}" class="w-full rounded-xl border border-slate-300 p-2 text-xs font-bold" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">رقم واتساب لاستقبال الرسائل المباشرة (مع كود الدولة مثل 2010...):</label>
                  <input type="text" id="adm-wa-phone" value="${escapeHtml(waCfg.phone)}" placeholder="مثال: 201012345678" class="w-full rounded-xl border border-slate-300 p-2 text-xs font-mono font-bold" />
                </div>
                <button type="button" onclick="BaccApp.adminSaveWhatsAppSettings()" class="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-black py-2.5 rounded-xl text-xs">
                  حفظ إعدادات تحويل واتساب
                </button>
              </div>

              <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h3 class="font-black text-base text-slate-900">💳 التحكم في أسعار الباقات</h3>
                ${adminData.plans
                  .map(
                    p => `
                  <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span class="text-xs font-bold text-slate-800">${escapeHtml(p.name)}</span>
                    <div class="flex items-center gap-1.5">
                      <input type="number" id="plan-price-${p.id}" value="${p.price_egp}" class="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold" />
                      <button type="button" onclick="BaccApp.adminUpdatePlan('${p.id}')" class="bg-teal-700 text-white px-2.5 py-1 rounded-lg text-xs font-bold">تحديث</button>
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 class="font-black text-base text-slate-900">🧾 سجل طلبات وتفعيلات الاشتراكات</h3>
              ${
                adminData.subscriptions.length === 0
                  ? `<p class="text-xs text-slate-500 py-4">لا توجد طلبات اشتراك مسجلة بعد.</p>`
                  : `
                <div class="overflow-x-auto">
                  <table class="w-full text-xs text-right">
                    <thead>
                      <tr class="border-b border-slate-200 text-slate-500">
                        <th class="py-2">الطالب</th>
                        <th class="py-2">الباقة</th>
                        <th class="py-2">المبلغ</th>
                        <th class="py-2">الحالة والانتهاء</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      ${adminData.subscriptions
                        .map(
                          sc => `
                        <tr>
                          <td class="py-2.5 font-bold">${escapeHtml(sc.student_name)}</td>
                          <td class="py-2.5 text-teal-800 font-bold">${escapeHtml(sc.plan_name)}</td>
                          <td class="py-2.5 font-black text-emerald-700">${sc.amount_egp} ج.م</td>
                          <td class="py-2.5 text-slate-600">${escapeHtml(sc.status)} ${sc.expires_at ? '• حتى ' + escapeHtml(sc.expires_at) : ''}</td>
                        </tr>
                      `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
              }
            </div>
          </div>
        </div>
      `;
    } else if (AppState.adminTab === 'rbac') {
      sectionHtml = `
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-black text-base text-slate-900">🔐 سجل التدقيق الأمني وإدارة الصلاحيات (RBAC & Security Audit Log)</h3>
              <p class="text-xs text-slate-500">يتم تسجيل كل عملية دخول أو تعديل أو محاولة وصول غير مصرح بها على مستوى قاعدة البيانات.</p>
            </div>
            <span class="bg-emerald-100 text-emerald-900 text-xs font-extrabold px-3 py-1 rounded-full">RLS Active</span>
          </div>
          <div class="overflow-x-auto max-h-96 bacc-scrollbar">
            <table class="w-full text-xs text-right">
              <thead>
                <tr class="border-b border-slate-200 text-slate-500">
                  <th class="py-2">التوقيت</th>
                  <th class="py-2">المستخدم / المنفذ</th>
                  <th class="py-2">الحدث الأمني / الإداري</th>
                  <th class="py-2">المستوى</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${(adminData.vault.audit_logs || [])
                  .map(
                    log => `
                  <tr>
                    <td class="py-2 text-slate-400 font-mono">${escapeHtml(log.timestamp)}</td>
                    <td class="py-2 font-bold text-slate-800">${escapeHtml(log.actor)}</td>
                    <td class="py-2 text-slate-700">${escapeHtml(log.action)}</td>
                    <td class="py-2">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.severity === 'security' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                      }">${escapeHtml(log.severity)}</span>
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (AppState.adminTab === 'database') {
      const cloudCfg = global.BaccSupabaseConnector.getCloudConfig();
      sectionHtml = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="font-black text-base text-slate-900">🗄️ إعدادات الربط السحابي بقاعدة بيانات Supabase</h3>
              <span class="bg-amber-100 text-amber-900 text-[11px] font-extrabold px-2.5 py-1 rounded-lg">سري للمدير فقط</span>
            </div>
            <p class="text-xs text-slate-600 leading-relaxed">
              لا يتم تخزين أي مفاتيح سرية داخل كود الواجهة المصدري. يمكنك إدخال رابط مشروع Supabase ومفتاح <code>Anon Public Key</code> الخاص بك لتفعيل المزامنة السحابية مع الجداول الـ 12 المحمية بسياسات <code>Row-Level Security</code>.
            </p>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Supabase Project URL:</label>
              <input type="text" id="adm-supa-url" value="${escapeHtml(cloudCfg.url)}" placeholder="https://your-project-id.supabase.co" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Supabase Public Anon Key:</label>
              <input type="password" id="adm-supa-key" value="${escapeHtml(cloudCfg.anonKey)}" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono" />
            </div>
            <div class="flex gap-2">
              <button type="button" onclick="BaccApp.adminTestAndSaveSupabase()" class="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-black py-2.5 rounded-xl text-xs">
                🔌 فحص وحفظ إعدادات الاتصال بـ Supabase
              </button>
            </div>
          </div>

          <div class="lg:col-span-6 bg-slate-900 text-white p-6 rounded-2xl border border-slate-700 shadow-sm space-y-3">
            <h3 class="font-black text-base text-amber-400">🛡️ حالة الجداول وسياسات الحماية (PostgreSQL RLS Status)</h3>
            <p class="text-xs text-slate-300">
              جميع الجداول الـ 12 محمية بدالة <code>public.is_admin()</code> وسياسات <code>ALTER TABLE ... ENABLE ROW LEVEL SECURITY</code>:
            </p>
            <div class="grid grid-cols-2 gap-2 text-xs">
              ${[
                'public.profiles (RLS ✓)',
                'public.stages (RLS ✓)',
                'public.tracks (RLS ✓)',
                'public.subjects (RLS ✓)',
                'public.units (RLS ✓)',
                'public.lessons (RLS ✓)',
                'public.lesson_progress (RLS ✓)',
                'public.exams (RLS ✓)',
                'public.exam_submissions (RLS ✓)',
                'public.subscriptions (RLS ✓)',
                'public.admin_system_settings (Admin Only 🔒)',
                'public.admin_backups (Admin Only 🔒)'
              ]
                .map(
                  tbl => `<div class="bg-white/10 px-3 py-2 rounded-lg font-mono text-[11px] text-teal-300">${tbl}</div>`
                )
                .join('')}
            </div>
          </div>
        </div>
      `;
    } else if (AppState.adminTab === 'backups') {
      sectionHtml = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 class="font-black text-base text-slate-900">💾 إنشاء وتصدير نسخة احتياطية آمنة (Signed JSON Backup)</h3>
            <p class="text-xs text-slate-600">
              يتم توقيع النسخة الاحتياطية ببصمة تحقق <code>SHA-256 Checksum</code> وتشمل كافة حسابات الطلاب، الدروس، الامتحانات، الدرجات، والاشتراكات.
            </p>
            <input type="text" id="adm-bkp-label" placeholder="وصف النسخة الاحتياطية (اختياري)" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
            <div class="flex flex-wrap gap-2">
              <button type="button" onclick="BaccApp.adminExportBackup()" class="bg-teal-700 hover:bg-teal-800 text-white font-black px-5 py-2.5 rounded-xl text-xs">
                ⬇️ إنشاء وتحميل ملف النسخة الاحتياطية (.json)
              </button>
              <button type="button" onclick="BaccApp.adminResetFactory()" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold px-4 py-2.5 rounded-xl text-xs">
                🔄 استعادة ضبط المصنع القياسي
              </button>
            </div>

            <div class="pt-3 border-t border-slate-100 space-y-2">
              <h4 class="text-xs font-black text-slate-700">سجل النسخ الاحتياطية المحفوظة:</h4>
              ${(adminData.vault.backups || [])
                .map(
                  b => `
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <div class="font-bold text-slate-900">${escapeHtml(b.label)}</div>
                    <div class="text-[10px] text-slate-500 font-mono">${escapeHtml(b.created_at)} • ${escapeHtml(b.checksum)}</div>
                  </div>
                  <span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">${b.records_count} سجل</span>
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 class="font-black text-base text-slate-900">♻️ استعادة قاعدة البيانات من نسخة احتياطية</h3>
            <p class="text-xs text-slate-600">
              يمكنك رفع ملف النسخة الاحتياطية <code>.json</code> أو لصق محتواه لاستعادة كافة بيانات المنصة فوراً:
            </p>
            <input type="file" id="adm-restore-file" accept=".json" onchange="BaccApp.adminLoadRestoreFile(this)" class="w-full text-xs text-slate-600 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-800" />
            <textarea id="adm-restore-json" rows="5" placeholder='الصق كود النسخة الاحتياطية JSON هنا أو اختر الملف من الأعلى...' class="w-full rounded-xl border border-slate-300 p-3 text-xs font-mono"></textarea>
            <button type="button" onclick="BaccApp.adminExecuteRestore()" class="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-black py-3 rounded-xl text-xs shadow">
              ⚡ تنفيذ الاستعادة الفورية لقاعدة البيانات
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div class="bg-slate-950 text-white rounded-3xl p-6 border-2 border-amber-500/40 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="bg-amber-500 text-slate-950 text-xs font-black px-3 py-0.5 rounded-full">ADMIN CONTROL PANEL</span>
              <span class="text-xs text-teal-300 font-mono">moazelokly568@gmail.com</span>
            </div>
            <h1 class="text-xl sm:text-2xl font-black">لوحة التحكم الإدارية الشاملة — Baccalaureate Academy</h1>
            <p class="text-xs text-slate-400">إدارة كاملة للطلاب، المدرسين، المراحل، المواد، الدروس، الامتحانات، الاشتراكات، قاعدة البيانات، والنسخ الاحتياطي.</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          ${tabBtn('overview', 'الإحصائيات والأرباح', '📈')}
          ${tabBtn('users', 'الطلاب والمدرسين', '👥')}
          ${tabBtn('stages_subjects', 'المراحل والمواد', '📚')}
          ${tabBtn('lessons_exams', 'الدروس والامتحانات والأخبار', '🎬')}
          ${tabBtn('subscriptions', 'الاشتراكات والباقات', '💳')}
          ${tabBtn('rbac', 'الصلاحيات وسجل الأمان', '🔐')}
          ${tabBtn('database', 'قاعدة البيانات والإعدادات الحساسة', '🗄️')}
          ${tabBtn('backups', 'النسخ الاحتياطي والاستعادة', '💾')}
        </div>

        <div>${sectionHtml}</div>
      </div>
    `;
  }

  // ============================================================================
  // MODALS
  // ============================================================================
  function renderModals() {
    let html = '';

    if (AppState.searchOpen) {
      const results = global.BaccDB.globalSearch(AppState.searchQuery);
      html += `
        <div class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center p-4 pt-16">
          <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div class="p-4 bg-slate-900 text-white flex items-center gap-3">
              <span>🔍</span>
              <input type="text" id="global-search-input" value="${escapeHtml(AppState.searchQuery)}" oninput="BaccApp.updateSearchQuery(this.value)" placeholder="ابحث عن مادة، درس، مذكرة PDF، مدرس، أو امتحان..." class="flex-1 bg-transparent text-white placeholder-slate-400 text-sm font-bold focus:outline-none" autofocus />
              <button type="button" onclick="BaccApp.toggleSearchModal()" class="text-slate-300 hover:text-white font-black px-2">✕</button>
            </div>
            <div class="p-4 max-h-96 overflow-y-auto space-y-4 bacc-scrollbar">
              ${
                !AppState.searchQuery.trim()
                  ? `<div class="text-center py-6 text-xs text-slate-500">اكتب كلمة بحث مثل: <strong>الأحياء</strong>، <strong>اللغة العربية</strong>، <strong>الفيزياء</strong>، <strong>العلوم المتكاملة</strong>، أو <strong>محمود الشافعي</strong>.</div>`
                  : `
                ${
                  results.subjects.length > 0
                    ? `
                  <div>
                    <div class="text-xs font-black text-teal-800 mb-2">📚 المواد الدراسية (${results.subjects.length})</div>
                    <div class="space-y-1.5">
                      ${results.subjects
                        .map(
                          s => `
                        <button type="button" onclick="BaccApp.openSubjectFromSearch('${s.id}')" class="w-full text-right p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50 border border-slate-200 flex items-center justify-between text-xs">
                          <span class="font-bold text-slate-900">${escapeHtml(s.name)}</span>
                          <span class="text-teal-700 font-bold">فتح المادة ←</span>
                        </button>
                      `
                        )
                        .join('')}
                    </div>
                  </div>
                `
                    : ''
                }
                ${
                  results.lessons.length > 0
                    ? `
                  <div>
                    <div class="text-xs font-black text-teal-800 mb-2">🎬 الدروس والمذكرات (${results.lessons.length})</div>
                    <div class="space-y-1.5">
                      ${results.lessons
                        .map(
                          l => `
                        <button type="button" onclick="BaccApp.openLessonFromSearch('${l.subject_id}', '${l.id}')" class="w-full text-right p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50 border border-slate-200 flex items-center justify-between text-xs">
                          <div>
                            <div class="font-bold text-slate-900">${escapeHtml(l.title)}</div>
                            <div class="text-[10px] text-slate-500">${escapeHtml(l.subject_name)}</div>
                          </div>
                          <span class="text-teal-700 font-bold">مشاهدة ←</span>
                        </button>
                      `
                        )
                        .join('')}
                    </div>
                  </div>
                `
                    : ''
                }
                ${
                  results.teachers.length > 0
                    ? `
                  <div>
                    <div class="text-xs font-black text-teal-800 mb-2">👨‍🏫 هيئة التدريس (${results.teachers.length})</div>
                    <div class="space-y-1.5">
                      ${results.teachers
                        .map(
                          t => `
                        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                          <span class="font-bold text-slate-900">${escapeHtml(t.name)}</span> — <span class="text-teal-700">${escapeHtml(t.subject_specialty)}</span>
                        </div>
                      `
                        )
                        .join('')}
                    </div>
                  </div>
                `
                    : ''
                }
                ${
                  results.subjects.length === 0 && results.lessons.length === 0 && results.teachers.length === 0
                    ? `<div class="text-center py-6 text-xs text-slate-500">لا توجد نتائج مطابقة لبحثك.</div>`
                    : ''
                }
              `
              }
            </div>
          </div>
        </div>
      `;
    }

    if (AppState.authModalOpen) {
      const stages = global.BaccDB.getStages();
      const tracks = global.BaccDB.getTracks();
      html += `
        <div class="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div class="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 class="font-black text-base">بوابة الحسابات الآمنة — Baccalaureate Academy</h3>
                <p class="text-[11px] text-slate-400">تأمين كامل عبر SHA-256 وسياسات صلاحيات RLS</p>
              </div>
              <button type="button" onclick="BaccApp.closeAuthModal()" class="text-slate-300 hover:text-white font-black px-2">✕</button>
            </div>

            <div class="grid grid-cols-3 sm:grid-cols-5 bg-slate-100 p-1.5 gap-1 border-b border-slate-200 text-[11px] font-extrabold">
              <button type="button" onclick="BaccApp.setAuthTab('student_login')" class="py-2 rounded-xl transition ${
                AppState.authTab === 'student_login' ? 'bg-teal-700 text-white shadow' : 'text-slate-700'
              }">👨‍🎓 دخول طالب</button>
              <button type="button" onclick="BaccApp.setAuthTab('student_register')" class="py-2 rounded-xl transition ${
                AppState.authTab === 'student_register' ? 'bg-teal-700 text-white shadow' : 'text-slate-700'
              }">✨ طالب جديد</button>
              <button type="button" onclick="BaccApp.setAuthTab('teacher_login')" class="py-2 rounded-xl transition ${
                AppState.authTab === 'teacher_login' || AppState.authTab === 'teacher_register' ? 'bg-indigo-700 text-white shadow' : 'text-slate-700'
              }">👨‍🏫 المدرسون</button>
              <button type="button" onclick="BaccApp.setAuthTab('forgot_password')" class="py-2 rounded-xl transition ${
                AppState.authTab === 'forgot_password' || AppState.authTab === 'reset_password' ? 'bg-amber-600 text-white shadow' : 'text-slate-700'
              }">🔑 استعادة المرور</button>
              <button type="button" onclick="BaccApp.setAuthTab('admin_login')" class="py-2 rounded-xl transition ${
                AppState.authTab === 'admin_login' ? 'bg-slate-900 text-amber-400 shadow' : 'text-slate-700'
              }">🛡️ المدير</button>
            </div>

            <div class="p-6 space-y-4">
              ${
                AppState.authTab === 'student_login'
                  ? `
                <div class="space-y-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني للطالب:</label>
                    <input type="email" id="auth-stu-email" value="" placeholder="أدخل بريدك الإلكتروني" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">كلمة المرور:</label>
                    <input type="password" id="auth-stu-pass" value="" placeholder="أدخل كلمة المرور (أو استخدم زر الدخول التجريبي بالأسفل)" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  </div>
                  <button type="button" onclick="BaccApp.handleStudentLogin()" class="w-full bg-teal-700 hover:bg-teal-800 text-white font-black py-3 rounded-xl text-xs shadow">
                    تسجيل دخول الطالب
                  </button>
                  <div class="pt-2 border-t border-slate-100 text-center">
                    <button type="button" onclick="BaccApp.setAuthTab('student_register')" class="text-xs text-teal-700 font-bold hover:underline">
                      ليس لديك حساب؟ اضغط هنا لإنشاء حساب طالب جديد
                    </button>
                  </div>
                </div>
              `
                  : AppState.authTab === 'student_register'
                  ? `
                <div class="space-y-2.5">
                  <input type="text" id="reg-stu-name" placeholder="الاسم الكامل للطالب" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  <input type="email" id="reg-stu-email" placeholder="البريد الإلكتروني" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  <div class="grid grid-cols-2 gap-2">
                    <input type="password" id="reg-stu-pass" placeholder="كلمة المرور" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                    <input type="password" id="reg-stu-confirm" placeholder="تأكيد كلمة المرور" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <select id="reg-stu-grade" class="rounded-xl border border-slate-300 p-2.5 text-xs font-bold">
                      ${stages.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
                    </select>
                    <select id="reg-stu-track" class="rounded-xl border border-slate-300 p-2.5 text-xs font-bold">
                      ${tracks.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
                    </select>
                  </div>
                  <input type="text" id="reg-stu-avatar" placeholder="صورة شخصية اختيارية (رمز أو رابط صورة)" value="👨‍🎓" class="w-full rounded-xl border border-slate-300 p-2 text-xs font-bold" />
                  <button type="button" onclick="BaccApp.handleStudentRegister()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl text-xs shadow">
                    إنشاء حساب الطالب وربطه بـ Supabase
                  </button>
                </div>
              `
                  : AppState.authTab === 'teacher_login'
                  ? `
                <div class="space-y-3">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-black text-indigo-950">👨‍🏫 تسجيل دخول المدرسين</span>
                    <button type="button" onclick="BaccApp.setAuthTab('teacher_register')" class="text-indigo-700 font-bold underline">+ إنشاء حساب مدرس جديد</button>
                  </div>
                  <input type="email" id="auth-tch-email" value="" placeholder="البريد الإلكتروني للمدرس" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  <input type="password" id="auth-tch-pass" placeholder="كلمة مرور المدرس" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  <button type="button" onclick="BaccApp.handleTeacherLogin()" class="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-black py-3 rounded-xl text-xs shadow">
                    دخول لوحة تحكم المدرس
                  </button>

                </div>
              `
                  : AppState.authTab === 'teacher_register'
                  ? `
                <div class="space-y-2.5">
                  <div class="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[11px] text-amber-900">
                    يتم إنشاء حساب المدرس بحالة <strong>«قيد المراجعة»</strong> ويحتاج لموافقة المدير قبل نشر المحتوى.
                  </div>
                  <input type="text" id="reg-tch-name" placeholder="الاسم الكامل للمدرس واللقب العلمي" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  <input type="email" id="reg-tch-email" placeholder="البريد الإلكتروني الأكاديمي" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  <input type="text" id="reg-tch-spec" placeholder="التخصص والمواد التي يقوم بتدريسها" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  <div class="grid grid-cols-2 gap-2">
                    <input type="password" id="reg-tch-pass" placeholder="كلمة المرور" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                    <input type="password" id="reg-tch-confirm" placeholder="تأكيد كلمة المرور" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  </div>
                  <button type="button" onclick="BaccApp.handleTeacherRegister()" class="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-black py-3 rounded-xl text-xs shadow">
                    تسجيل طلب حساب مدرس (قيد المراجعة)
                  </button>
                </div>
              `
                  : AppState.authTab === 'forgot_password'
                  ? `
                <div class="space-y-3">
                  <h4 class="font-black text-xs text-slate-900">🔑 صفحة استعادة كلمة المرور (Supabase Auth Recovery)</h4>
                  <p class="text-[11px] text-slate-600">أدخل بريدك الإلكتروني لإصدار رمز تحقق آمن لإعادة تعيين كلمة المرور الخاصة بك.</p>
                  <input type="email" id="forgot-email-input" value="${escapeHtml(AppState.resetEmail || 'ahmed.tarek@student.moe.eg')}" placeholder="البريد الإلكتروني المسجل" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  <button type="button" onclick="BaccApp.handleRequestPasswordReset()" class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl text-xs shadow">
                    إرسال رمز استعادة كلمة المرور
                  </button>
                </div>
              `
                  : AppState.authTab === 'reset_password'
                  ? `
                <div class="space-y-3">
                  <h4 class="font-black text-xs text-slate-900">🔄 صفحة إعادة تعيين كلمة المرور الجديدة</h4>
                  ${
                    AppState.issuedResetCode
                      ? `<div class="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-[11px] text-teal-900">رمز التحقق الصادر لحسابك: <strong class="font-mono">${escapeHtml(AppState.issuedResetCode)}</strong></div>`
                      : ''
                  }
                  <input type="email" id="reset-email-input" value="${escapeHtml(AppState.resetEmail)}" placeholder="البريد الإلكتروني" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  <input type="text" id="reset-code-input" value="${escapeHtml(AppState.issuedResetCode)}" placeholder="رمز التحقق (مثال: RST-XXXX)" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono font-bold" />
                  <input type="password" id="reset-new-pass" placeholder="كلمة المرور الجديدة" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  <input type="password" id="reset-confirm-pass" placeholder="تأكيد كلمة المرور الجديدة" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  <button type="button" onclick="BaccApp.handleConfirmPasswordReset()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl text-xs shadow">
                    حفظ كلمة المرور الجديدة والدخول
                  </button>
                </div>
              `
                  : `
                <div class="space-y-3">
                  <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">
                    <strong>🔒 بوابة الإدارة المشفرة:</strong> مخصصة حصرياً لمدير المنصة (Admin). يتم التحقق من بيانات الاعتماد عبر خوارزمية التشفير <code>SHA-256</code> دون تخزين نص كلمة المرور في الواجهة.
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني للمدير (Admin Email):</label>
                    <input type="email" id="auth-adm-email" placeholder="moazelokly568@gmail.com" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">كلمة مرور المدير (Admin Password):</label>
                    <input type="password" id="auth-adm-pass" placeholder="أدخل كلمة مرور المدير المعتمدة" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
                  </div>
                  <button type="button" onclick="BaccApp.handleAdminLogin()" class="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-black py-3 rounded-xl text-xs shadow-lg">
                    🛡️ تحقق ودخول لوحة تحكم المدير
                  </button>
                </div>
              `
              }
            </div>
          </div>
        </div>
      `;
    }

    if (AppState.waModalData) {
      const w = AppState.waModalData;
      html += `
        <div class="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white rounded-3xl shadow-2xl border-2 border-emerald-500 w-full max-w-md overflow-hidden p-6 space-y-4 text-right">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <div class="flex items-center gap-2">
                <span class="text-2xl">📲</span>
                <h3 class="font-black text-base text-slate-900">تحويل مباشر إلى واتساب الإدارة</h3>
              </div>
              <button type="button" onclick="BaccApp.closeWaModal()" class="text-slate-400 hover:text-slate-700 font-black">✕</button>
            </div>
            <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs space-y-1.5">
              <div class="font-bold text-emerald-950">حساب التواصل الرسمي للإدارة: <span class="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300">${escapeHtml(w.handle)}</span></div>
              <p class="text-slate-600">تم نسخ تفاصيل طلب اشتراكك تلقائياً، ويمكنك إرسالها مباشرة عبر واتساب لتفعيل اشتراكك وتحديد مدته:</p>
            </div>
            <pre class="whitespace-pre-wrap font-sans text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-slate-800 leading-relaxed">${escapeHtml(w.message)}</pre>
            <div class="flex flex-col gap-2">
              <a href="${escapeHtml(w.waUrl)}" target="_blank" rel="noopener noreferrer" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl text-xs text-center shadow-lg block">
                💬 فتح محادثة واتساب الآن وإرسال الطلب (${escapeHtml(w.handle)})
              </a>
              <button type="button" onclick="BaccApp.copyWaMessage()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl text-xs">
                📋 نسخ نص الرسالة وحساب (${escapeHtml(w.handle)})
              </button>
            </div>
          </div>
        </div>
      `;
    }
    return html;
  }


  // ============================================================================
  // COURSES CATALOG & FILTERING VIEW (المرحلة الرابعة: نظام الكورسات والبحث والتصفية)
  // ============================================================================
  function renderCoursesView() {
    const stages = global.BaccDB.getStages();
    const subjects = global.BaccDB.getSubjects({ stage_id: AppState.courseStageFilter });
    const teachers = global.BaccDB.getTeachers();
    const courses = global.BaccDB.getCourses({
      stage_id: AppState.courseStageFilter,
      subject_id: AppState.courseSubjectFilter,
      teacher_id: AppState.courseTeacherFilter,
      search: AppState.courseSearchQuery
    });
    const meta = global.BaccDB.getMeta();

    return `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">


        <div class="bacc-hero-gradient text-white rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="space-y-2 max-w-2xl">
            <span class="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold px-3 py-1 rounded-full">نظام الكورسات المتكامل — المرحلة الرابعة</span>
            <h1 class="text-2xl sm:text-3xl font-black">دليل الكورسات والوحدات التعليمية للمراحل الثلاث</h1>
            <p class="text-xs sm:text-sm text-slate-200 leading-relaxed">
              تصفح الكورسات حسب المرحلة الدراسية والمادة والمدرس، وتابع نسبة إنجازك واستكمل التعلم من آخر درس ونقطة زمنية توقفت عندها.
            </p>
          </div>
          <div class="bg-white/10 rounded-2xl p-4 border border-white/15 text-center min-w-[200px]">
            <div class="text-xs text-slate-300">إجمالي الكورسات المعتمدة</div>
            <div class="text-3xl font-black text-amber-400 my-1">${courses.length} كورس</div>
            <div class="text-[11px] text-teal-300">مرتبطة بـ Supabase Storage</div>
          </div>
        </div>

        <!-- Multi-Filter & Search Bar -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1">بحث في الكورسات والمواد والمدرسين:</label>
            <input type="text" value="${escapeHtml(AppState.courseSearchQuery)}" oninput="BaccApp.setCourseSearch(this.value)" placeholder="ابحث باسم الكورس أو المادة أو المدرس..." class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1">المرحلة الدراسية:</label>
            <select onchange="BaccApp.setCourseStageFilter(this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold bg-slate-50">
              <option value="all" ${AppState.courseStageFilter === 'all' ? 'selected' : ''}>جميع المراحل الثلاث</option>
              ${stages.map(s => `<option value="${s.id}" ${AppState.courseStageFilter === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1">المادة الدراسية:</label>
            <select onchange="BaccApp.setCourseSubjectFilter(this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold bg-slate-50">
              <option value="all" ${AppState.courseSubjectFilter === 'all' ? 'selected' : ''}>جميع المواد</option>
              ${subjects.map(s => `<option value="${s.id}" ${AppState.courseSubjectFilter === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1">المدرس المسؤول:</label>
            <select onchange="BaccApp.setCourseTeacherFilter(this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold bg-slate-50">
              <option value="all" ${AppState.courseTeacherFilter === 'all' ? 'selected' : ''}>جميع المدرسين</option>
              ${teachers.map(t => `<option value="${t.id}" ${AppState.courseTeacherFilter === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Courses Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${courses
            .map(
              crs => `
            <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between bacc-card-hover">
              <div>
                <div class="h-36 bg-slate-900 relative overflow-hidden">
                  <img src="${escapeHtml(crs.image_url)}" alt="${escapeHtml(crs.title)}" class="w-full h-full object-cover opacity-80" />
                  <div class="absolute top-3 right-3 bg-slate-950/80 text-amber-400 text-[11px] font-extrabold px-2.5 py-1 rounded-full">
                    ${escapeHtml(crs.stage_name)}
                  </div>
                  <div class="absolute top-3 left-3 ${
                    crs.is_premium ? 'bg-amber-500 text-slate-950' : 'bg-emerald-600 text-white'
                  } text-[11px] font-extrabold px-2.5 py-1 rounded-full">
                    ${crs.is_premium ? crs.price_egp + ' ج.م (مدفوع)' : 'مجاني مفتوح'}
                  </div>
                </div>

                <div class="p-5 space-y-3">
                  <div class="text-xs font-bold text-teal-700">${escapeHtml(crs.subject_name)}</div>
                  <h3 class="text-base font-black text-slate-900 leading-snug">${escapeHtml(crs.title)}</h3>
                  <p class="text-xs text-slate-600 leading-relaxed">${escapeHtml(crs.description)}</p>
                  <div class="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <span>👨‍🏫 ${escapeHtml(crs.teacher_name)}</span>
                    <span>⏱️ ${crs.duration_hours} ساعة</span>
                  </div>
                  <div class="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center text-xs border border-slate-100">
                    <div><strong class="block text-slate-900">${crs.units_count}</strong><span class="text-[10px] text-slate-500">وحدات</span></div>
                    <div><strong class="block text-teal-700">${crs.lessons_count}</strong><span class="text-[10px] text-slate-500">دروس</span></div>
                    <div><strong class="block text-amber-600">${crs.progress_percent}%</strong><span class="text-[10px] text-slate-500">إنجازك</span></div>
                  </div>
                </div>
              </div>

              <div class="px-5 pb-5 pt-1 flex gap-2">
                <button type="button" onclick="BaccApp.openSubject('${crs.subject_id}')" class="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-bold py-2.5 rounded-xl text-xs transition">
                  📖 صفحة الكورس والدروس
                </button>
                ${
                  crs.last_lesson_id
                    ? `<button type="button" onclick="BaccApp.resumeCourseFromLastPoint('${crs.subject_id}', '${crs.last_lesson_id}')" class="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-3 py-2.5 rounded-xl text-xs transition" title="استكمال التعلم">
                        ⏯️ استكمال
                      </button>`
                    : ''
                }
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  // ============================================================================
  // TEACHER DASHBOARD VIEW (المرحلة الثالثة والرابعة: لوحة تحكم المدرس المستقلة)
  // ============================================================================
  function renderTeacherDashboardView() {
    let tData;
    try {
      tData = global.BaccDB.getTeacherDashboardData();
    } catch (err) {
      return `
        <div class="max-w-xl mx-auto my-12 bg-white p-8 rounded-3xl border-2 border-indigo-200 text-center space-y-4 shadow-lg">
          <div class="text-4xl">👨‍🏫</div>
          <h2 class="text-xl font-black text-indigo-950">بوابة ولوحة تحكم المدرسين (محمية بـ RLS)</h2>
          <p class="text-xs text-slate-600">${escapeHtml(err.message)}</p>
          <button type="button" onclick="BaccApp.openAuthModal('teacher_login')" class="bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl text-xs">تسجيل دخول المدرس</button>
        </div>
      `;
    }

    const allSubjects = global.BaccDB.getSubjects();

    return `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div class="bg-gradient-to-l from-indigo-950 via-slate-900 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-2xl">${escapeHtml(tData.teacher.avatar_url || '👨‍🏫')}</span>
              <span class="bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-extrabold px-3 py-1 rounded-full">لوحة تحكم المدرس</span>
              <span class="px-3 py-1 rounded-full text-xs font-black ${
                tData.is_approved ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'
              }">
                ${tData.is_approved ? '✓ حساب مدرس نشط ومعتمد' : '⏳ حساب قيد المراجعة (بانتظار موافقة المدير)'}
              </span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black">${escapeHtml(tData.teacher.full_name)}</h1>
            <p class="text-xs text-slate-300">التخصص: ${escapeHtml(tData.teacher.specialty || 'مناهج البكالوريا المصرية')} • البريد: ${escapeHtml(tData.teacher.email)}</p>
          </div>

          <div class="grid grid-cols-3 gap-3 text-center">
            <div class="bg-white/10 p-3 rounded-2xl border border-white/10">
              <div class="text-xl font-black text-amber-400">${tData.courses.length}</div>
              <div class="text-[11px] text-slate-300">كورساتي</div>
            </div>
            <div class="bg-white/10 p-3 rounded-2xl border border-white/10">
              <div class="text-xl font-black text-teal-300">${tData.lessons.length}</div>
              <div class="text-[11px] text-slate-300">دروسي المنشورة</div>
            </div>
            <div class="bg-white/10 p-3 rounded-2xl border border-white/10">
              <div class="text-xl font-black text-indigo-300">${tData.student_results.length}</div>
              <div class="text-[11px] text-slate-300">نتائج طلابي</div>
            </div>
          </div>
        </div>

        ${
          !tData.is_approved
            ? `
          <div class="bg-amber-50 border-2 border-amber-400 rounded-2xl p-5 text-amber-950 space-y-1">
            <h3 class="font-black text-sm">⚠️ تنبيه صلاحيات النشر (RLS Teacher Approval Policy):</h3>
            <p class="text-xs leading-relaxed">
              حسابك حالياً في حالة <strong>«قيد المراجعة (pending_review)»</strong>. وفق سياسات الأمان في قاعدة البيانات، لا يمكنك نشر كورسات أو دروس أو اختبارات للطلاب إلا بعد اعتماد حسابك من قِبل مدير المنصة (Admin).
            </p>
          </div>
        `
            : ''
        }

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Teacher Course & Lesson Creation Forms -->
          <div class="lg:col-span-5 space-y-6">
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 class="font-black text-base text-slate-900">➕ إضافة كورس جديد أو درس ورفع مذكرة PDF</h3>
              <select id="tch-les-subject" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold">
                ${(tData.subjects.length ? tData.subjects : allSubjects)
                  .map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
                  .join('')}
              </select>
              <input type="text" id="tch-les-title" placeholder="عنوان الدرس الجديد" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
              <input type="text" id="tch-les-video" placeholder="رابط فيديو الشرح" value="https://www.youtube.com/embed/J9w-N3xS2sI" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
              <input type="text" id="tch-les-pdf-name" placeholder="اسم ملف الـ PDF لرفعه في Supabase Storage" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
              <textarea id="tch-les-pdf-body" rows="3" placeholder="محتوى مذكرة الدرس والملخص..." class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold"></textarea>
              <button type="button" onclick="BaccApp.teacherPublishLesson()" class="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-black py-2.5 rounded-xl text-xs shadow">
                📤 نشر الدرس ورفع المذكرة إلى Supabase Storage
              </button>
            </div>

            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 class="font-black text-base text-slate-900">📝 إنشاء اختبار إلكتروني لطلابي</h3>
              <select id="tch-ex-subject" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold">
                ${(tData.subjects.length ? tData.subjects : allSubjects)
                  .map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
                  .join('')}
              </select>
              <input type="text" id="tch-ex-title" placeholder="عنوان الاختبار" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
              <input type="text" id="tch-ex-q1" placeholder="نص السؤال الأول" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
              <button type="button" onclick="BaccApp.teacherPublishExam()" class="w-full bg-teal-700 hover:bg-teal-800 text-white font-black py-2.5 rounded-xl text-xs shadow">
                ✅ نشر الاختبار للطلاب
              </button>
            </div>
          </div>

          <!-- Teacher Lessons & Student Results -->
          <div class="lg:col-span-7 space-y-6">
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 class="font-black text-base text-slate-900">📚 دروسي المنشورة وحالة مراجعتها (${tData.lessons.length})</h3>
              <div class="divide-y divide-slate-100 max-h-64 overflow-y-auto bacc-scrollbar text-xs">
                ${tData.lessons
                  .map(
                    l => `
                  <div class="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div class="font-bold text-slate-900">${escapeHtml(l.title)}</div>
                      <div class="text-[11px] text-slate-500">📄 ${escapeHtml(l.pdf_title)}</div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full font-bold text-[10px] ${
                      l.review_status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                    }">${l.review_status === 'approved' ? 'معتمد ومنشور' : 'قيد المراجعة'}</span>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 class="font-black text-base text-slate-900">📊 متابعة نتائج الطلاب في موادي (${tData.student_results.length})</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-xs text-right">
                  <thead>
                    <tr class="border-b border-slate-200 text-slate-500">
                      <th class="py-2">الطالب</th>
                      <th class="py-2">الاختبار</th>
                      <th class="py-2">الدرجة</th>
                      <th class="py-2">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    ${tData.student_results
                      .map(
                        r => `
                      <tr>
                        <td class="py-2 font-bold">${escapeHtml(r.student_name)}</td>
                        <td class="py-2 text-slate-700">${escapeHtml(r.exam_title)}</td>
                        <td class="py-2 font-black text-emerald-700">${r.score} / ${r.total_marks} (${r.percentage}%)</td>
                        <td class="py-2 text-slate-400">${escapeHtml(r.submitted_at)}</td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // PROFILE PAGE & LOGOUT CONFIRMATION PAGE (المرحلة الثالثة)
  // ============================================================================
  function renderProfilePageView() {
    const user = global.BaccDB.getCurrentUser();
    if (!user) {
      return `
        <div class="max-w-xl mx-auto my-12 bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-4">
          <h2 class="text-xl font-black">يرجى تسجيل الدخول لعرض وتعديل ملفك الشخصي</h2>
          <button type="button" onclick="BaccApp.openAuthModal('student_login')" class="bg-teal-700 text-white font-bold px-6 py-3 rounded-xl text-xs">تسجيل الدخول</button>
        </div>
      `;
    }
    const stages = global.BaccDB.getStages();
    const tracks = global.BaccDB.getTracks();

    return `
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div class="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-2xl bg-teal-700 text-white flex items-center justify-center text-3xl shadow">
                ${escapeHtml(user.avatar_url || '👤')}
              </div>
              <div>
                <span class="bg-teal-50 text-teal-900 border border-teal-200 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                  الدور: ${user.role === 'admin' ? 'مدير النظام (Admin)' : user.role === 'teacher' ? 'مدرس' : 'طالب'}
                </span>
                <h1 class="text-xl sm:text-2xl font-black text-slate-900 mt-1">${escapeHtml(user.full_name)}</h1>
                <p class="text-xs text-slate-500">${escapeHtml(user.email)}</p>
              </div>
            </div>
            <button type="button" onclick="BaccApp.logout()" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold px-4 py-2.5 rounded-xl text-xs">
              🚪 تسجيل الخروج الآمن
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل:</label>
              <input type="text" id="prof-full-name" value="${escapeHtml(user.full_name)}" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">الصورة الشخصية / الرمز التعبيري:</label>
              <input type="text" id="prof-avatar" value="${escapeHtml(user.avatar_url || '👨‍🎓')}" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">المرحلة الدراسية:</label>
              <select id="prof-stage" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold">
                ${stages.map(s => `<option value="${s.id}" ${s.id === (user.stage_id || user.grade_id) ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">المسار التخصصي:</label>
              <select id="prof-track" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold">
                ${tracks.map(t => `<option value="${t.id}" ${t.id === user.track_id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف:</label>
              <input type="text" id="prof-phone" value="${escapeHtml(user.phone || '')}" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">المحافظة:</label>
              <input type="text" id="prof-gov" value="${escapeHtml(user.governorate || 'الشرقية')}" class="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold" />
            </div>
          </div>

          <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-1">
            <div class="font-black text-slate-800">🔐 صلاحيات الحساب الممنوحة في قاعدة البيانات (RBAC & RLS Permissions):</div>
            <div class="text-teal-800 font-mono">${escapeHtml((user.permissions || []).join(' • '))}</div>
          </div>

          <div class="flex justify-end gap-3">
            <button type="button" onclick="BaccApp.saveProfilePageChanges()" class="bg-teal-700 hover:bg-teal-800 text-white font-black px-6 py-3 rounded-xl text-xs shadow">
              💾 حفظ تعديلات الملف الشخصي
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderLogoutPageView() {
    return `
      <div class="max-w-lg mx-auto my-14 bg-white rounded-3xl p-8 border border-slate-200 shadow-lg text-center space-y-4">
        <div class="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl mx-auto">👋</div>
        <h1 class="text-2xl font-black text-slate-900">تم تسجيل خروجك وإغلاق الجلسة بأمان</h1>
        <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
          تم إنهاء جلسة المصادقة الخاصة بك (${escapeHtml(AppState.lastLoggedOutEmail || 'المستخدم')}) وحفظ تقدمك الدراسي في قاعدة البيانات.
        </p>
        <div class="flex justify-center gap-3 pt-2">
          <button type="button" onclick="BaccApp.openAuthModal('student_login')" class="bg-teal-700 hover:bg-teal-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs">
            🔑 تسجيل الدخول مجدداً
          </button>
          <button type="button" onclick="BaccApp.navigate('home')" class="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-5 py-2.5 rounded-xl text-xs">
            🏠 العودة للصفحة الرئيسية
          </button>
        </div>
      </div>
    `;
  }

  function renderFooter() {
    return `
      <footer class="bg-slate-950 text-slate-400 py-8 px-4 sm:px-6 border-t border-slate-800 mt-12 no-print">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-teal-700 text-amber-400 font-black flex items-center justify-center">B</div>
            <div>
              <span class="font-bold text-white">Baccalaureate Academy — أكاديمية البكالوريا المصرية</span>
              <p class="text-[11px] text-slate-500">جميع المراحل الدراسية الثلاث والمسارات الأربعة وفق أحدث المناهج الرسمية 2026/2027</p>
            </div>
          </div>
          <div class="flex flex-wrap gap-3">
            <button type="button" onclick="BaccApp.openStage('grade_1')" class="hover:text-white">الصف الأول الثانوي</button>
            <button type="button" onclick="BaccApp.openStage('grade_2')" class="hover:text-white">الصف الثاني الثانوي</button>
            <button type="button" onclick="BaccApp.openStage('grade_3')" class="hover:text-white">الصف الثالث الثانوي</button>
            <button type="button" onclick="BaccApp.navigate('exams')" class="hover:text-white">الامتحانات الشاملة</button>
            <button type="button" onclick="BaccApp.navigate('pricing')" class="hover:text-white">الاشتراكات</button>
          </div>
        </div>
      </footer>
    `;
  }

  function renderApp() {
    destroyCharts();
    const root = document.getElementById('bacc-app-root');
    if (!root) return;

    const lockCheck = global.BaccDB.checkStudentSubscriptionLock();
    if (lockCheck && lockCheck.isLocked) {
      root.innerHTML =
        renderNavbar() +
        `<main class="min-h-[75vh] flex items-center justify-center p-4">
          <div class="max-w-lg w-full bg-white rounded-3xl p-8 border-2 border-red-400 shadow-2xl text-center space-y-4">
            <div class="w-16 h-16 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center text-3xl mx-auto">⛔</div>
            <span class="inline-block bg-red-100 text-red-900 text-xs font-extrabold px-3 py-1 rounded-full">انتهت صلاحية الاشتراك</span>
            <h1 class="text-2xl font-black text-slate-900">توقفت المنصة لانتهاء مدة اشتراكك المحددة</h1>
            <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
              عزيزي الطالب <strong>${escapeHtml(lockCheck.user.full_name)}</strong>، لقد انتهت الفترة الزمنية المحددة لاشتراكك في المنصة. لتجديد الاشتراك وإعادة تفعيل حسابك فوراً، يرجى التواصل مباشرة مع م. معاذ العقلي عبر واتساب (<strong>${escapeHtml(lockCheck.whatsappHandle)}</strong>).
            </p>
            <div class="pt-2 flex flex-col sm:flex-row justify-center gap-3">
              <button type="button" onclick="BaccApp.completeSubscriptionCheckout()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-xl text-xs shadow-lg">
                📲 تواصل مع الإدارة لتجديد الاشتراك (${escapeHtml(lockCheck.whatsappHandle)})
              </button>
              <button type="button" onclick="BaccApp.logout()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl text-xs">
                تسجيل الخروج
              </button>
            </div>
          </div>
        </main>` +
        renderFooter() +
        renderModals();
      return;
    }

    let mainViewHtml = '';
    if (AppState.currentView === 'home') {
      mainViewHtml = renderHomeView();
    } else if (AppState.currentView === 'stage') {
      mainViewHtml = renderStageView();
    } else if (AppState.currentView === 'subject') {
      mainViewHtml = renderSubjectView();
    } else if (AppState.currentView === 'exams') {
      mainViewHtml = renderExamsHubView();
    } else if (AppState.currentView === 'exam_runner') {
      mainViewHtml = renderExamRunnerView();
    } else if (AppState.currentView === 'pricing') {
      mainViewHtml = renderPricingView();
    } else if (AppState.currentView === 'news') {
      mainViewHtml = renderNewsView();
    } else if (AppState.currentView === 'student_dashboard') {
      mainViewHtml = renderStudentDashboardView();
    } else if (AppState.currentView === 'admin_dashboard') {
      mainViewHtml = renderAdminDashboardView();
    } else if (AppState.currentView === 'courses') {
      mainViewHtml = renderCoursesView();
    } else if (AppState.currentView === 'teacher_dashboard') {
      mainViewHtml = renderTeacherDashboardView();
    } else if (AppState.currentView === 'profile_page') {
      mainViewHtml = renderProfilePageView();
    } else if (AppState.currentView === 'logout_page') {
      mainViewHtml = renderLogoutPageView();
    } else {
      mainViewHtml = renderHomeView();
    }

    root.innerHTML = renderNavbar() + '<main class="min-h-[75vh]">' + mainViewHtml + '</main>' + renderFooter() + renderModals();

    if (AppState.currentView === 'home') {
      global.BaccApp.recalculateBaccalaureateScore();
    }
    if (AppState.currentView === 'admin_dashboard' && AppState.adminTab === 'overview') {
      initAdminCharts();
    }
  }

  function initAdminCharts() {
    if (typeof global.Chart === 'undefined') return;
    let adminData;
    try {
      adminData = global.BaccDB.adminGetCompleteDashboard();
    } catch (e) {
      return;
    }

    const trackCtx = document.getElementById('adminTrackChart');
    if (trackCtx) {
      AppState.chartInstances.track = new global.Chart(trackCtx, {
        type: 'doughnut',
        data: {
          labels: adminData.trackDistribution.map(t => t.name),
          datasets: [
            {
              data: adminData.trackDistribution.map(t => Math.max(1, t.count)),
              backgroundColor: ['#0f766e', '#059669', '#1d4ed8', '#d97706', '#7e22ce']
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { font: { family: 'Cairo', size: 11 } } }
          }
        }
      });
    }

    const revCtx = document.getElementById('adminRevenueChart');
    if (revCtx) {
      AppState.chartInstances.rev = new global.Chart(revCtx, {
        type: 'bar',
        data: {
          labels: ['سبتمبر', 'أكتوبر', 'نوفمبر (الحالي)', 'مستهدف ديسمبر'],
          datasets: [
            {
              label: 'إيرادات الاشتراكات (ج.م)',
              data: [420, 800, adminData.stats.total_revenue_egp, adminData.stats.total_revenue_egp + 950],
              backgroundColor: '#0f766e',
              borderRadius: 8
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { font: { family: 'Cairo', size: 11 } } }
          }
        }
      });
    }
  }

  global.BaccApp = {
    init() {
      renderApp();
    },

    navigate(viewName) {
      clearTimers();
      if (viewName !== 'exam_runner') clearExamTimer();
      AppState.currentView = viewName;
      AppState.notifOpen = false;
      AppState.searchOpen = false;
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    scrollToSection(secId) {
      const el = document.getElementById(secId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    },

    openStage(stageId) {
      clearTimers();
      AppState.selectedStageId = stageId;
      AppState.selectedTrackFilter = 'all';
      AppState.currentView = 'stage';
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    openStageWithTrack(stageId, trackId) {
      clearTimers();
      AppState.selectedStageId = stageId;
      AppState.selectedTrackFilter = trackId;
      AppState.currentView = 'stage';
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    setTrackFilter(trackId) {
      AppState.selectedTrackFilter = trackId;
      renderApp();
    },

    openSubject(subjectId) {
      clearTimers();
      AppState.selectedSubjectId = subjectId;
      const details = global.BaccDB.getSubjectDetails(subjectId);
      AppState.selectedLessonId = details && details.all_lessons.length ? details.all_lessons[0].id : null;
      AppState.lessonTab = 'video';
      AppState.quizAnswers = {};
      AppState.quizSubmitted = false;
      AppState.studioSeconds = 0;
      AppState.currentView = 'subject';
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    selectLesson(lessonId) {
      clearTimers();
      AppState.selectedLessonId = lessonId;
      AppState.quizAnswers = {};
      AppState.quizSubmitted = false;
      AppState.studioSeconds = 0;
      renderApp();
    },

    setLessonTab(tabName) {
      clearTimers();
      AppState.lessonTab = tabName;
      renderApp();
    },

    setVideoMode(mode) {
      clearTimers();
      AppState.videoMode = mode;
      renderApp();
    },

    toggleStudioPlay(maxSeconds) {
      if (AppState.studioPlaying) {
        clearTimers();
        renderApp();
        return;
      }
      AppState.studioPlaying = true;
      playAcademySound('start');
      renderApp();
      this.speakCurrentSlideNow();
      AppState.studioInterval = setInterval(() => {
        AppState.studioSeconds += AppState.studioSpeed;
        if (AppState.studioSeconds >= maxSeconds) {
          AppState.studioSeconds = maxSeconds;
          clearTimers();
          renderApp();
          showToast('اكتمل تشغيل شرح الدرس! يمكنك الآن حل التدريب التفاعلي.', 'success');
          return;
        }
        const lbl = document.getElementById('studio-time-label');
        if (lbl) lbl.textContent = formatSeconds(AppState.studioSeconds) + ' / ' + formatSeconds(maxSeconds);
      }, 1000);
    },

    setStudioSlide(idx) {
      AppState.studioSlideIdx = Number(idx || 0);
      playAcademySound('slide');
      renderApp();
      if (AppState.studioPlaying) {
        this.speakCurrentSlideNow();
      }
    },

    toggleStudioMute() {
      AppState.studioMuted = !AppState.studioMuted;
      if (AppState.studioMuted) {
        stopArabicSpeech();
      } else {
        playAcademySound('start');
        if (AppState.studioPlaying) this.speakCurrentSlideNow();
      }
      renderApp();
    },

    speakCurrentSlideNow() {
      const details = global.BaccDB.getSubjectDetails(AppState.selectedSubjectId);
      const les = details ? details.all_lessons.find(l => l.id === AppState.selectedLessonId) : null;
      if (!les) return;
      playAcademySound('slide');
      const txt =
        AppState.studioSlideIdx === 0
          ? les.title + '. ' + les.video_summary
          : AppState.studioSlideIdx === 1
          ? les.pdf_content
          : 'خلاصة الدرس وأهم نقاط الامتحان: ' + les.video_summary;
      speakArabicLecture(txt);
    },

    seekStudioVideo(val) {
      AppState.studioSeconds = Number(val || 0);
      try {
        if (global.BaccDB.getCurrentUser() && AppState.selectedLessonId) {
          global.BaccDB.saveStudentLessonProgress({
            lessonId: AppState.selectedLessonId,
            lastPositionSeconds: AppState.studioSeconds
          });
        }
      } catch (e) {}
      renderApp();
    },

    changeStudioSpeed() {
      const speeds = [1, 1.25, 1.5, 2];
      const idx = speeds.indexOf(AppState.studioSpeed);
      AppState.studioSpeed = speeds[(idx + 1) % speeds.length];
      renderApp();
    },

    toggleLessonCompleteBtn(lessonId) {
      try {
        const prog = global.BaccDB.toggleLessonCompleted(lessonId);
        showToast(prog.completed ? 'تم تسجيل الدرس كمكتمل وتحديث نسبة تقدمك ✓' : 'تمت إعادة الدرس إلى قائمة قيد الدراسة', 'success');
        renderApp();
      } catch (e) {
        if (e.message.includes('RLS_AUTH_REQUIRED')) {
          showToast('يرجى تسجيل الدخول بحساب طالب أولاً لحفظ تقدمك الدراسي.', 'warning');
          this.openAuthModal('student_login');
        } else {
          showToast(e.message, 'error');
        }
      }
    },

    saveLessonNotes(lessonId) {
      const box = document.getElementById('student-lesson-notes');
      const notes = box ? box.value : '';
      try {
        global.BaccDB.toggleLessonCompleted(lessonId, notes);
        showToast('تم حفظ ملاحظاتك الشخصية على هذا الدرس بنجاح.', 'success');
      } catch (e) {
        showToast('يرجى تسجيل الدخول أولاً لحفظ الملاحظات.', 'warning');
        this.openAuthModal('student_login');
      }
    },

    downloadLessonPdf(lessonId) {
      const details = global.BaccDB.getSubjectDetails(AppState.selectedSubjectId);
      if (!details) return;
      const les = details.all_lessons.find(l => l.id === lessonId);
      if (!les || !les.can_view) return;
      const content =
        '============================================================\n' +
        'Baccalaureate Academy - أكاديمية البكالوريا المصرية\n' +
        'المادة: ' + details.name + '\n' +
        'الدرس: ' + les.title + '\n' +
        '============================================================\n\n' +
        les.pdf_content +
        '\n\n------------------------------------------------------------\n' +
        'ملخص المحاضرة:\n' +
        les.video_summary +
        '\n';
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = les.pdf_title.replace(/\.pdf$/i, '') + '.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('تم تنزيل مذكرة الدرس بنجاح.', 'success');
    },

    pickLessonQuizOption(qIdx, optIdx) {
      if (AppState.quizSubmitted) return;
      AppState.quizAnswers[qIdx] = optIdx;
      renderApp();
    },

    submitLessonQuiz(lessonId) {
      const details = global.BaccDB.getSubjectDetails(AppState.selectedSubjectId);
      const les = details ? details.all_lessons.find(l => l.id === lessonId) : null;
      if (!les) return;
      const questions = les.quiz_questions || [];
      let correctCount = 0;
      questions.forEach((q, idx) => {
        if (String(AppState.quizAnswers[idx]) === String(q.correct)) correctCount++;
      });
      const scorePct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 100;
      AppState.quizSubmitted = true;
      try {
        if (global.BaccDB.getCurrentUser()) {
          global.BaccDB.toggleLessonCompleted(lessonId, undefined, scorePct);
        }
      } catch (e) {
        // ignore if guest previewing free lesson
      }
      showToast('نتيجة تدريب الدرس: ' + scorePct + '% (' + correctCount + ' من ' + questions.length + ')', 'success');
      renderApp();
    },

    resetLessonQuiz() {
      AppState.quizAnswers = {};
      AppState.quizSubmitted = false;
      renderApp();
    },

    setExamStageFilter(val) {
      AppState.examStageFilter = val;
      AppState.examSubjectFilter = 'all';
      renderApp();
    },

    setExamSubjectFilter(val) {
      AppState.examSubjectFilter = val;
      renderApp();
    },

    startExam(examId, opportunityLabel) {
      const user = global.BaccDB.getCurrentUser();
      if (!user) {
        showToast('يرجى تسجيل الدخول بحساب طالب أولاً لبدء الاختبار وتسجيل درجتك في السجل.', 'warning');
        this.openAuthModal('student_login');
        return;
      }
      const exams = global.BaccDB.getExams();
      const ex = exams.find(e => e.id === examId);
      if (!ex) return;
      if (!ex.can_access) {
        showToast('هذا الاختبار يتطلب الاشتراك في المادة أولاً.', 'warning');
        this.startSubjectCheckout(ex.subject_id);
        return;
      }
      clearExamTimer();
      AppState.activeExamId = examId;
      AppState.activeExamOpportunity = opportunityLabel || 'الفرصة الأولى الأساسية';
      AppState.activeExamAnswers = {};
      AppState.lastExamResult = null;
      AppState.activeExamSecondsLeft = (ex.duration_minutes || 30) * 60;
      AppState.currentView = 'exam_runner';
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });

      AppState.activeExamTimer = setInterval(() => {
        AppState.activeExamSecondsLeft--;
        const disp = document.getElementById('exam-timer-display');
        if (disp) disp.textContent = formatSeconds(AppState.activeExamSecondsLeft);
        if (AppState.activeExamSecondsLeft <= 0) {
          clearExamTimer();
          this.finishActiveExam();
        }
      }, 1000);
    },

    setExamOpportunity(val) {
      AppState.activeExamOpportunity = val;
    },

    setExamAnswer(qId, ansVal) {
      AppState.activeExamAnswers[qId] = ansVal;
      renderApp();
    },

    setExamAnswerText(qId, textVal) {
      AppState.activeExamAnswers[qId] = textVal;
    },

    finishActiveExam() {
      clearExamTimer();
      try {
        const result = global.BaccDB.submitExamAttempt(
          AppState.activeExamId,
          AppState.activeExamAnswers,
          AppState.activeExamOpportunity
        );
        AppState.lastExamResult = result;
        showToast(
          'تم تصحيح الاختبار تلقائياً! درجتك: ' +
            result.submission.score +
            ' والدرجة الأعلى المحتسبة: ' +
            result.highestOfficialScore,
          'success'
        );
        renderApp();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    recalculateBaccalaureateScore() {
      const ids = ['calc_g2_ar', 'calc_g2_en', 'calc_g2_hi', 'calc_g2_sp', 'calc_g3_s1', 'calc_g3_s2'];
      let sumHighest = 0;
      ids.forEach(prefix => {
        const el1 = document.getElementById(prefix + '_1');
        const el2 = document.getElementById(prefix + '_2');
        if (el1 && el2) {
          const v1 = Math.min(100, Math.max(0, Number(el1.value || 0)));
          const v2 = Math.min(100, Math.max(0, Number(el2.value || 0)));
          sumHighest += Math.max(v1, v2);
        }
      });
      const totalEl = document.getElementById('calc-total-score');
      const pctEl = document.getElementById('calc-total-pct');
      if (totalEl && pctEl) {
        totalEl.textContent = sumHighest + ' / 600';
        pctEl.textContent = ((sumHighest / 600) * 100).toFixed(2) + '%';
      }
      const slider = document.getElementById('calc_assessment_slider');
      const valLbl = document.getElementById('calc-assessment-val');
      const statusLbl = document.getElementById('calc-assessment-status');
      if (slider && valLbl && statusLbl) {
        const ratio = Number(slider.value || 0);
        valLbl.textContent = ratio + '% من الأداءات مكتملة';
        if (ratio >= 60) {
          statusLbl.textContent = 'مؤهل لدخول الفرصة الأولى ✓';
          statusLbl.className = 'bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold';
        } else {
          statusLbl.textContent = 'أقل من 60% (غير مؤهل بعد)';
          statusLbl.className = 'bg-red-500/30 text-red-200 px-2.5 py-0.5 rounded-full font-bold';
        }
      }
    },

    startSubjectCheckout(subjectId) {
      AppState.checkoutPlanId = 'plan_subject';
      AppState.checkoutSubjectId = subjectId;
      AppState.currentView = 'pricing';
      renderApp();
      setTimeout(() => {
        const box = document.getElementById('checkout-payment-box');
        if (box) box.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    },

    selectCheckoutPlan(planId) {
      if (planId === 'plan_free') {
        showToast('الباقة التأسيسية المجانية مفعلة تلقائياً لجميع الطلاب.', 'info');
        return;
      }
      AppState.checkoutPlanId = planId;
      renderApp();
    },

    setCheckoutSubject(subId) {
      AppState.checkoutSubjectId = subId;
      renderApp();
    },

    setPaymentMethod(method) {
      AppState.checkoutPaymentMethod = method;
      renderApp();
    },

    completeSubscriptionCheckout() {
      const refInput = document.getElementById('checkout-ref-input');
      const refVal = refInput ? refInput.value.trim() : '';
      try {
        const res = global.BaccDB.requestWhatsAppSubscription({
          planId: AppState.checkoutPlanId,
          subjectId: AppState.checkoutSubjectId,
          studentPhone: refVal
        });
        AppState.waModalData = res;
        try {
          const ta = document.createElement('textarea');
          ta.value = res.message;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        } catch (e) {}
        renderApp();
        try {
          window.open(res.waUrl, '_blank', 'noopener,noreferrer');
        } catch (e) {}
        showToast('تم تجهيز طلب اشتراكك وتحويلك إلى واتساب الإدارة (' + res.handle + ') ✓', 'success');
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    closeWaModal() {
      AppState.waModalData = null;
      renderApp();
    },

    copyWaMessage() {
      if (!AppState.waModalData) return;
      try {
        const ta = document.createElement('textarea');
        ta.value = AppState.waModalData.message;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showToast('تم نسخ رسالة الاشتراك وحساب (' + AppState.waModalData.handle + ') بنجاح!', 'success');
      } catch (e) {}
    },

    toggleSearchModal() {
      AppState.searchOpen = !AppState.searchOpen;
      AppState.notifOpen = false;
      renderApp();
    },

    updateSearchQuery(val) {
      AppState.searchQuery = val;
      renderApp();
      const input = document.getElementById('global-search-input');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    },

    openSubjectFromSearch(subId) {
      AppState.searchOpen = false;
      this.openSubject(subId);
    },

    openLessonFromSearch(subId, lesId) {
      AppState.searchOpen = false;
      AppState.selectedSubjectId = subId;
      AppState.selectedLessonId = lesId;
      AppState.lessonTab = 'video';
      AppState.currentView = 'subject';
      renderApp();
    },

    toggleNotifications() {
      AppState.notifOpen = !AppState.notifOpen;
      renderApp();
    },

    markNotificationsRead() {
      global.BaccDB.markAllNotificationsRead();
      renderApp();
    },

    openAuthModal(tab) {
      AppState.authTab = tab || 'student_login';
      AppState.authModalOpen = true;
      renderApp();
    },

    closeAuthModal() {
      AppState.authModalOpen = false;
      renderApp();
    },

    setAuthTab(tab) {
      AppState.authTab = tab;
      renderApp();
    },

    handleStudentLogin() {
      const email = (document.getElementById('auth-stu-email') || {}).value || '';
      const pass = (document.getElementById('auth-stu-pass') || {}).value || '';
      const res = global.BaccDB.login(email, pass, 'student');
      if (!res.ok) {
        showToast(res.error, 'error');
        return;
      }
      AppState.authModalOpen = false;
      showToast('مرحباً بك ' + res.user.full_name, 'success');
      this.navigate('student_dashboard');
    },

    quickDemoStudentLogin() {
      const res = global.BaccDB.login('ahmed.tarek@student.moe.eg', 'Student2026#', 'student');
      if (res.ok) {
        AppState.authModalOpen = false;
        showToast('تم الدخول بحساب الطالب: ' + res.user.full_name, 'success');
        this.navigate('student_dashboard');
      }
    },

    handleStudentRegister() {
      const full_name = (document.getElementById('reg-stu-name') || {}).value || '';
      const email = (document.getElementById('reg-stu-email') || {}).value || '';
      const password = (document.getElementById('reg-stu-pass') || {}).value || '';
      const confirm_password = (document.getElementById('reg-stu-confirm') || {}).value || password;
      const grade_id = (document.getElementById('reg-stu-grade') || {}).value || 'grade_2';
      const track_id = (document.getElementById('reg-stu-track') || {}).value || 'track_med';
      const avatar_url = (document.getElementById('reg-stu-avatar') || {}).value || '👨‍🎓';
      const res = global.BaccDB.registerStudent({ full_name, email, password, confirm_password, stage_id: grade_id, grade_id, track_id, avatar_url });
      if (!res.ok) {
        showToast(res.error, 'error');
        return;
      }
      AppState.authModalOpen = false;
      showToast('تم إنشاء حسابك بنجاح وربطه بملفك الشخصي في Supabase!', 'success');
      this.navigate('student_dashboard');
    },

    handleTeacherLogin() {
      const email = (document.getElementById('auth-tch-email') || {}).value || '';
      const pass = (document.getElementById('auth-tch-pass') || {}).value || '';
      const res = global.BaccDB.login(email, pass, 'teacher');
      if (!res.ok) {
        showToast(res.error, 'error');
        return;
      }
      AppState.authModalOpen = false;
      showToast('مرحباً بك في لوحة المدرس: ' + res.user.full_name, 'success');
      this.navigate('teacher_dashboard');
    },

    quickDemoTeacherLogin(mode) {
      const email = mode === 'pending' ? 'khaled.farouk@teacher.bacc.eg' : 'mahmoud.shafei@teacher.bacc.eg';
      const res = global.BaccDB.login(email, 'Teacher2026#', 'teacher');
      if (res.ok) {
        AppState.authModalOpen = false;
        showToast('تم الدخول بحساب المدرس: ' + res.user.full_name, 'success');
        this.navigate('teacher_dashboard');
      }
    },

    handleTeacherRegister() {
      const full_name = (document.getElementById('reg-tch-name') || {}).value || '';
      const email = (document.getElementById('reg-tch-email') || {}).value || '';
      const specialty = (document.getElementById('reg-tch-spec') || {}).value || '';
      const password = (document.getElementById('reg-tch-pass') || {}).value || '';
      const confirm_password = (document.getElementById('reg-tch-confirm') || {}).value || '';
      const res = global.BaccDB.registerTeacher({ full_name, email, specialty, password, confirm_password });
      if (!res.ok) {
        showToast(res.error, 'error');
        return;
      }
      AppState.authModalOpen = false;
      showToast('تم تسجيل حساب المدرس بحالة (قيد المراجعة) بانتظار موافقة المدير.', 'info');
      this.navigate('teacher_dashboard');
    },

    handleRequestPasswordReset() {
      const email = (document.getElementById('forgot-email-input') || {}).value || '';
      const res = global.BaccDB.requestPasswordReset(email);
      if (!res.ok) {
        showToast(res.error, 'error');
        return;
      }
      AppState.resetEmail = res.email;
      AppState.issuedResetCode = res.resetCode;
      AppState.authTab = 'reset_password';
      showToast(res.message + ' الرمز: ' + res.resetCode, 'success');
      renderApp();
    },

    handleConfirmPasswordReset() {
      const email = (document.getElementById('reset-email-input') || {}).value || '';
      const code = (document.getElementById('reset-code-input') || {}).value || '';
      const newPass = (document.getElementById('reset-new-pass') || {}).value || '';
      const confPass = (document.getElementById('reset-confirm-pass') || {}).value || '';
      const res = global.BaccDB.confirmPasswordReset(email, code, newPass, confPass);
      if (!res.ok) {
        showToast(res.error, 'error');
        return;
      }
      showToast(res.message, 'success');
      AppState.authTab = 'student_login';
      renderApp();
    },

    handleAdminLogin() {
      const email = (document.getElementById('auth-adm-email') || {}).value || '';
      const pass = (document.getElementById('auth-adm-pass') || {}).value || '';
      const res = global.BaccDB.login(email, pass, 'admin');
      if (!res.ok) {
        showToast(res.error, 'error');
        return;
      }
      AppState.authModalOpen = false;
      showToast('مرحباً بك في لوحة تحكم المدير العام: ' + res.user.full_name, 'success');
      this.navigate('admin_dashboard');
    },

    logout() {
      const res = global.BaccDB.logout();
      AppState.lastLoggedOutEmail = res.loggedOutEmail || '';
      showToast('تم تسجيل الخروج وإغلاق الجلسة بأمان.', 'info');
      this.navigate('logout_page');
    },

    saveProfilePageChanges() {
      try {
        const user = global.BaccDB.getCurrentUser();
        if (!user) return;
        const full_name = (document.getElementById('prof-full-name') || {}).value || '';
        const avatar_url = (document.getElementById('prof-avatar') || {}).value || '';
        const stage_id = (document.getElementById('prof-stage') || {}).value || '';
        const track_id = (document.getElementById('prof-track') || {}).value || '';
        const phone = (document.getElementById('prof-phone') || {}).value || '';
        const governorate = (document.getElementById('prof-gov') || {}).value || '';
        global.BaccDB.updateUserProfile(user.id, { full_name, avatar_url, stage_id, track_id, phone, governorate });
        showToast('تم حفظ بيانات ملفك الشخصي في قاعدة البيانات بنجاح.', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    setCourseSearch(val) {
      AppState.courseSearchQuery = val;
      renderApp();
    },

    setCourseStageFilter(val) {
      AppState.courseStageFilter = val;
      AppState.courseSubjectFilter = 'all';
      renderApp();
    },

    setCourseSubjectFilter(val) {
      AppState.courseSubjectFilter = val;
      renderApp();
    },

    setCourseTeacherFilter(val) {
      AppState.courseTeacherFilter = val;
      renderApp();
    },

    resumeCourseFromLastPoint(subjectId, lessonId) {
      clearTimers();
      AppState.selectedSubjectId = subjectId;
      const details = global.BaccDB.getSubjectDetails(subjectId);
      const targetLes = details ? details.all_lessons.find(l => l.id === lessonId) || details.all_lessons[0] : null;
      AppState.selectedLessonId = targetLes ? targetLes.id : lessonId;
      AppState.lessonTab = 'video';
      AppState.studioSeconds = targetLes && targetLes.last_position_seconds ? Number(targetLes.last_position_seconds) : 0;
      AppState.currentView = 'subject';
      renderApp();
      showToast('تم استئناف التعلم من آخر درس ونقطة توقفت عندها (' + formatSeconds(AppState.studioSeconds) + ') ✓', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    generateLessonSignedUrl(lessonId) {
      try {
        const details = global.BaccDB.getSubjectDetails(AppState.selectedSubjectId);
        const les = details ? details.all_lessons.find(l => l.id === lessonId) : null;
        if (!les) return;
        let attId = les.attachments && les.attachments[0] ? les.attachments[0].id : null;
        if (!attId) {
          const created = global.BaccDB.uploadLessonAttachment({
            lesson_id: lessonId,
            file_name: les.pdf_title,
            content_text: les.pdf_content
          });
          attId = created.id;
        }
        const signed = global.BaccDB.getSignedAttachmentUrl(attId);
        AppState.lastGeneratedSignedUrl = signed;
        showToast('تم توليد رابط التحميل الآمن والموقّع من Supabase Storage ✓', 'success');
        renderApp();
      } catch (e) {
        if (e.message.includes('RLS_AUTH_REQUIRED')) {
          showToast('يرجى تسجيل الدخول أولاً لتوليد رابط موقّع (Signed URL).', 'warning');
          this.openAuthModal('student_login');
        } else {
          showToast(e.message, 'error');
        }
      }
    },

    teacherPublishLesson() {
      try {
        const subject_id = (document.getElementById('tch-les-subject') || {}).value || '';
        const title = (document.getElementById('tch-les-title') || {}).value || '';
        const video_url = (document.getElementById('tch-les-video') || {}).value || '';
        const pdf_title = (document.getElementById('tch-les-pdf-name') || {}).value || '';
        const pdf_content = (document.getElementById('tch-les-pdf-body') || {}).value || '';
        if (!title.trim()) {
          showToast('يرجى إدخال عنوان الدرس.', 'warning');
          return;
        }
        const les = global.BaccDB.adminUpsertLesson({
          subject_id,
          title,
          video_url,
          pdf_title: pdf_title || (title + '.pdf'),
          pdf_content: pdf_content || ('مذكرة الدرس: ' + title),
          is_free_preview: true
        });
        global.BaccDB.uploadLessonAttachment({
          lesson_id: les.id,
          file_name: les.pdf_title,
          content_text: les.pdf_content
        });
        showToast('تم نشر الدرس ورفع المذكرة إلى Supabase Storage بنجاح!', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    teacherPublishExam() {
      try {
        const subject_id = (document.getElementById('tch-ex-subject') || {}).value || '';
        const title = (document.getElementById('tch-ex-title') || {}).value || '';
        const sample_q1_text = (document.getElementById('tch-ex-q1') || {}).value || '';
        if (!title.trim()) {
          showToast('يرجى إدخال عنوان الاختبار.', 'warning');
          return;
        }
        global.BaccDB.adminCreateExam({ subject_id, title, sample_q1_text });
        showToast('تم إنشاء ونشر الاختبار الإلكتروني بنجاح!', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminHandleTeacherReview(teacherUserId, decision) {
      try {
        global.BaccDB.adminReviewTeacher(teacherUserId, decision);
        showToast(decision === 'approved' ? 'تم قبول واعتماد المدرس ومنحه صلاحية النشر ✓' : 'تم رفض طلب المدرس.', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminReviewLessonBtn(lessonId, decision) {
      try {
        global.BaccDB.adminReviewContent('lesson', lessonId, decision);
        showToast('تم تحديث حالة مراجعة الدرس إلى: ' + decision, 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminReorderLessonBtn(lessonId, dir) {
      try {
        global.BaccDB.reorderLesson(lessonId, dir);
        showToast('تم تحديث ترتيب الدرس بنجاح.', 'info');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminDeleteLessonBtn(lessonId) {
      try {
        global.BaccDB.adminDeleteLesson(lessonId);
        showToast('تم حذف الدرس من قاعدة البيانات.', 'info');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    saveStudentStageTrack() {
      const grade_id = (document.getElementById('stu-dash-grade') || {}).value;
      const track_id = (document.getElementById('stu-dash-track') || {}).value;
      const res = global.BaccDB.updateStudentProfile({ grade_id, track_id });
      if (res.ok) {
        showToast('تم تحديث مرحلتك ومسارك التخصصي بنجاح.', 'success');
        renderApp();
      }
    },

    setAdminTab(tab) {
      AppState.adminTab = tab;
      renderApp();
    },

    adminSaveUser() {
      try {
        const full_name = (document.getElementById('adm-usr-name') || {}).value || '';
        const email = (document.getElementById('adm-usr-email') || {}).value || '';
        const password = (document.getElementById('adm-usr-pass') || {}).value || '';
        const grade_id = (document.getElementById('adm-usr-grade') || {}).value || 'grade_2';
        const track_id = (document.getElementById('adm-usr-track') || {}).value || 'track_med';
        global.BaccDB.adminUpsertUser({ full_name, email, password, grade_id, track_id, role: 'student' });
        showToast('تم حفظ بيانات الطالب في قاعدة البيانات.', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminToggleUser(userId) {
      try {
        global.BaccDB.adminToggleUserStatus(userId);
        showToast('تم تحديث حالة الحساب.', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminRemoveUser(userId) {
      try {
        global.BaccDB.adminDeleteUser(userId);
        showToast('تم حذف الحساب من قاعدة البيانات.', 'info');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminSaveTeacher() {
      try {
        const name = (document.getElementById('adm-tch-name') || {}).value || '';
        const subject_specialty = (document.getElementById('adm-tch-spec') || {}).value || '';
        const bio = (document.getElementById('adm-tch-bio') || {}).value || '';
        if (!name.trim()) {
          showToast('يرجى إدخال اسم المدرس.', 'warning');
          return;
        }
        global.BaccDB.adminUpsertTeacher({ name, subject_specialty, bio });
        showToast('تمت إضافة المدرس بنجاح.', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminRemoveTeacher(teacherId) {
      try {
        global.BaccDB.adminDeleteTeacher(teacherId);
        showToast('تم حذف المدرس.', 'info');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminSaveSubject() {
      try {
        const name = (document.getElementById('adm-sub-name') || {}).value || '';
        const stage_id = (document.getElementById('adm-sub-stage') || {}).value || 'grade_2';
        const track_id = (document.getElementById('adm-sub-track') || {}).value || 'track_general';
        const category = (document.getElementById('adm-sub-cat') || {}).value || 'أساسية للمجموع';
        const teacher_id = (document.getElementById('adm-sub-teacher') || {}).value || '';
        const price_egp = (document.getElementById('adm-sub-price') || {}).value || 0;
        const description = (document.getElementById('adm-sub-desc') || {}).value || '';
        if (!name.trim()) {
          showToast('يرجى إدخال اسم المادة الدراسية.', 'warning');
          return;
        }
        global.BaccDB.adminUpsertSubject({
          name,
          stage_id,
          track_ids: [track_id],
          category,
          teacher_id,
          price_egp,
          description
        });
        showToast('تم حفظ المادة الدراسية بنجاح.', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminRemoveSubject(subId) {
      try {
        global.BaccDB.adminDeleteSubject(subId);
        showToast('تم حذف المادة الدراسية.', 'info');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminSaveLesson() {
      try {
        const subject_id = (document.getElementById('adm-les-subject') || {}).value || '';
        const title = (document.getElementById('adm-les-title') || {}).value || '';
        const video_url = (document.getElementById('adm-les-video') || {}).value || '';
        const pdf_title = (document.getElementById('adm-les-pdf-title') || {}).value || '';
        const pdf_content = (document.getElementById('adm-les-pdf-content') || {}).value || '';
        const is_free_preview = !!(document.getElementById('adm-les-free') || {}).checked;
        if (!title.trim()) {
          showToast('يرجى إدخال عنوان الدرس.', 'warning');
          return;
        }
        global.BaccDB.adminUpsertLesson({
          subject_id,
          title,
          video_url,
          pdf_title,
          pdf_content,
          is_free_preview
        });
        showToast('تم نشر الدرس الجديد وإرسال إشعار فوري للطلاب ✓', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminSaveExam() {
      try {
        const subject_id = (document.getElementById('adm-ex-subject') || {}).value || '';
        const title = (document.getElementById('adm-ex-title') || {}).value || '';
        const exam_type = (document.getElementById('adm-ex-type') || {}).value || '';
        const sample_q1_text = (document.getElementById('adm-ex-q1') || {}).value || '';
        if (!title.trim()) {
          showToast('يرجى إدخال عنوان الامتحان.', 'warning');
          return;
        }
        global.BaccDB.adminCreateExam({ subject_id, title, exam_type, sample_q1_text });
        showToast('تم إنشاء الامتحان وإرسال إشعار للطلاب ✓', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminSaveAnnouncement() {
      try {
        const title = (document.getElementById('adm-ann-title') || {}).value || '';
        const content = (document.getElementById('adm-ann-content') || {}).value || '';
        if (!title.trim() || !content.trim()) {
          showToast('يرجى إدخال عنوان وتفاصيل الإعلان.', 'warning');
          return;
        }
        global.BaccDB.adminPostAnnouncement({ title, content, is_pinned: true });
        showToast('تم نشر الخبر التعليمي بنجاح.', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminUpdatePlan(planId) {
      try {
        const inp = document.getElementById('plan-price-' + planId);
        const price = inp ? Number(inp.value) : 0;
        global.BaccDB.adminUpdatePlanPrice(planId, price);
        showToast('تم تحديث سعر الباقة بنجاح.', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminGrantPlan() {
      try {
        const stuId = (document.getElementById('adm-grant-student') || {}).value;
        const planId = (document.getElementById('adm-grant-plan') || {}).value;
        const days = Number((document.getElementById('adm-grant-days') || {}).value || 30);
        global.BaccDB.adminActivateStudentSubscription({
          studentId: stuId,
          planId,
          durationDays: days
        });
        showToast('تم تفعيل اشتراك الطالب لمدة ' + days + ' يوماً بنجاح ✓', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminQuickActivateStudent(studentId, durationDays) {
      try {
        global.BaccDB.adminActivateStudentSubscription({
          studentId,
          planId: 'plan_track',
          durationDays
        });
        showToast('تم تفعيل وتمديد اشتراك الطالب لمدة ' + durationDays + ' يوماً ✓', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminStopStudentSub(studentId) {
      try {
        global.BaccDB.adminExpireOrStopStudentSubscription(studentId);
        showToast('تم إيقاف اشتراك الطالب وإغلاق المنصة لحسابه حتى التجديد.', 'warning');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminSaveWhatsAppSettings() {
      try {
        const handle = (document.getElementById('adm-wa-handle') || {}).value || 'moaz.elokly@';
        const phone = (document.getElementById('adm-wa-phone') || {}).value || '';
        global.BaccDB.adminUpdateWhatsAppConfig(handle, phone);
        showToast('تم حفظ بيانات تواصل واتساب الإدارة (' + handle + ') بنجاح ✓', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    async adminTestAndSaveSupabase() {
      const url = (document.getElementById('adm-supa-url') || {}).value || '';
      const key = (document.getElementById('adm-supa-key') || {}).value || '';
      const res = await global.BaccSupabaseConnector.testConnection(url, key);
      if (!res.ok) {
        showToast(res.message, 'warning');
        return;
      }
      global.BaccSupabaseConnector.saveCloudConfig(url, key, true);
      showToast(res.message, 'success');
      renderApp();
    },

    adminExportBackup() {
      try {
        const label = (document.getElementById('adm-bkp-label') || {}).value || '';
        const res = global.BaccDB.adminCreateBackup(label);
        const blob = new Blob([res.exportJsonString], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'baccalaureate_academy_backup_' + Date.now() + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('تم إنشاء وتنزيل النسخة الاحتياطية الموقعة بنجاح.', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminLoadRestoreFile(inputEl) {
      if (!inputEl.files || !inputEl.files[0]) return;
      const reader = new FileReader();
      reader.onload = e => {
        const box = document.getElementById('adm-restore-json');
        if (box) box.value = e.target.result;
        showToast('تمت قراءة ملف النسخة الاحتياطية. اضغط على تنفيذ الاستعادة.', 'info');
      };
      reader.readAsText(inputEl.files[0]);
    },

    adminExecuteRestore() {
      try {
        const jsonStr = (document.getElementById('adm-restore-json') || {}).value || '';
        if (!jsonStr.trim()) {
          showToast('يرجى اختيار ملف النسخة الاحتياطية أو لصق كود JSON أولاً.', 'warning');
          return;
        }
        global.BaccDB.adminRestoreFromJson(jsonStr);
        showToast('تمت استعادة قاعدة البيانات بالكامل بنجاح!', 'success');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    adminResetFactory() {
      try {
        global.BaccDB.adminResetToFactorySeed();
        showToast('تمت إعادة ضبط المصنع للبيانات المرجعية.', 'info');
        renderApp();
      } catch (e) {
        showToast(e.message, 'error');
      }
    }
  };

  function safeBoot() {
    try {
      global.BaccApp.init();
    } catch (bootErr) {
      try {
        localStorage.removeItem('bacc_academy_db_v4_0');
        localStorage.removeItem('bacc_academy_session_v4_0');
      } catch (e) {}
      try {
        global.BaccApp.init();
      } catch (e2) {
        console.error('Boot error:', e2);
      }
    }
  }
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', safeBoot);
  } else {
    safeBoot();
  }
})(window);
