/* ============================================================
   PLANNING STATION-SERVICE v2 — Pro
   Multi-stations · Effectifs minimums · Préférences
   Horaires par station · Templates · Vue mensuelle · Alertes
   Synchronisation cloud Firebase
   ============================================================ */

const STORAGE_KEY = 'planning_station_v2';
const FIREBASE_CONFIG_KEY = 'planning_station_firebase_config';

// ============== FIREBASE SYNC LAYER ==============
const Cloud = {
    app: null,
    db: null,
    config: null,
    connected: false,
    syncing: false,        // Indique qu'une opération de sync est en cours pour éviter loop
    skipNextRemote: false, // Indique d'ignorer la prochaine notif remote (= notre propre push)
    unsubscribe: null,

    init() {
        // Charger la config sauvegardée
        try {
            const saved = localStorage.getItem(FIREBASE_CONFIG_KEY);
            if (!saved) return;
            this.config = JSON.parse(saved);
            this.connect();
        } catch (e) {
            console.warn('Cloud init failed', e);
        }
    },

    setStatus(status, label) {
        const el = document.getElementById('syncStatus');
        if (!el) return;
        el.classList.remove('sync-local', 'sync-connecting', 'sync-connected', 'sync-error');
        el.classList.add('sync-' + status);
        el.querySelector('.sync-label').textContent = label;
    },

    async connect() {
        if (!this.config || !window.__firebase) {
            this.setStatus('local', 'Local');
            return false;
        }
        try {
            this.setStatus('connecting', 'Connexion...');
            const { initializeApp, getDatabase, ref, onValue } = window.__firebase;
            this.app = initializeApp({
                apiKey: this.config.apiKey,
                authDomain: this.config.authDomain,
                databaseURL: this.config.databaseURL,
                projectId: this.config.projectId
            });
            this.db = getDatabase(this.app);

            // S'abonner aux modifs
            const dataRef = ref(this.db, 'planning_data');
            this.unsubscribe = onValue(dataRef, (snap) => {
                const data = snap.val();
                if (this.skipNextRemote) {
                    this.skipNextRemote = false;
                    return;
                }
                if (data && !this.syncing) {
                    // Données reçues du cloud → mettre à jour l'état local
                    this.applyRemoteData(data);
                }
            }, (err) => {
                console.error('Firebase error', err);
                this.setStatus('error', 'Erreur sync');
                toast('Erreur de synchronisation: ' + err.message, 'error', 5000);
            });

            this.connected = true;
            this.setStatus('connected', 'Cloud ✓');
            return true;
        } catch (e) {
            console.error('Firebase connect failed', e);
            this.setStatus('error', 'Erreur');
            toast('Connexion Firebase échouée: ' + e.message, 'error', 5000);
            return false;
        }
    },

    async push() {
        // Pousser l'état local vers Firebase
        if (!this.connected || !this.db) return;
        try {
            this.syncing = true;
            this.skipNextRemote = true;
            const { ref, set } = window.__firebase;
            await set(ref(this.db, 'planning_data'), state);
        } catch (e) {
            console.error('Push failed', e);
            toast('Erreur d\'envoi cloud: ' + e.message, 'error');
        } finally {
            this.syncing = false;
        }
    },

    async pull() {
        // Tirer l'état depuis Firebase et l'appliquer
        if (!this.connected || !this.db) return null;
        try {
            const { ref, get } = window.__firebase;
            const snap = await get(ref(this.db, 'planning_data'));
            return snap.val();
        } catch (e) {
            console.error('Pull failed', e);
            return null;
        }
    },

    applyRemoteData(data) {
        // Appliquer les données reçues du cloud sans déclencher de re-push
        if (!data) return;
        state = data;
        // Sauver localement aussi pour cache offline
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
        // Re-render tout
        if (typeof renderAll === 'function') {
            renderAll();
            toast('🔄 Mise à jour reçue du cloud', 'info', 2000);
        }
    },

    disconnect() {
        if (this.unsubscribe) { this.unsubscribe(); this.unsubscribe = null; }
        this.connected = false;
        this.config = null;
        this.app = null;
        this.db = null;
        localStorage.removeItem(FIREBASE_CONFIG_KEY);
        this.setStatus('local', 'Local');
    },

    saveConfig(config) {
        this.config = config;
        localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
    }
};

// ============== ÉTAT PAR DÉFAUT ==============
function defaultStationData(name = 'Ma station') {
    return {
        name,
        address: '',
        // Horaires d'ouverture par jour (0=lundi, 6=dimanche)
        openingHours: {
            0: { open: true, start: '06:00', end: '22:00' },
            1: { open: true, start: '06:00', end: '22:00' },
            2: { open: true, start: '06:00', end: '22:00' },
            3: { open: true, start: '06:00', end: '22:00' },
            4: { open: true, start: '06:00', end: '22:00' },
            5: { open: true, start: '07:00', end: '22:00' },
            6: { open: true, start: '08:00', end: '20:00' }
        },
        employees: [],
        shifts: {}, // 'employeeId_YYYY-MM-DD' -> { type, role, start, end, breakMin, note }
        leaves: [],
        shiftTypes: [
            { id: 's_morning', name: 'Matin', color: '#3b82f6',
              schedules: {
                weekday: { enabled: true, start: '06:00', end: '14:00' },
                weekend: { enabled: true, start: '07:00', end: '15:00' },
                holiday: { enabled: true, start: '07:00', end: '15:00' }
              }
            },
            { id: 's_afternoon', name: 'Après-midi', color: '#f59e0b',
              schedules: {
                weekday: { enabled: true, start: '14:00', end: '22:00' },
                weekend: { enabled: true, start: '15:00', end: '22:00' },
                holiday: { enabled: true, start: '15:00', end: '22:00' }
              }
            },
            { id: 's_night', name: 'Nuit', color: '#8b5cf6',
              schedules: {
                weekday: { enabled: true, start: '22:00', end: '06:00' },
                weekend: { enabled: true, start: '22:00', end: '07:00' },
                holiday: { enabled: true, start: '22:00', end: '07:00' }
              }
            }
        ],
        roles: [
            { id: 'r_pompiste', name: 'Pompiste', color: '#3b82f6', icon: '⛽' },
            { id: 'r_caissier', name: 'Caissier', color: '#10b981', icon: '💰' },
            { id: 'r_manager', name: 'Manager', color: '#f59e0b', icon: '⭐' }
        ],
        // Effectifs minimums : { dayType: { 'roleId_shiftId': nombre } }
        // dayType: 'weekday' | 'weekend' | 'holiday'
        requirements: {
            weekday: {
                'r_pompiste_s_morning': 3,
                'r_pompiste_s_afternoon': 3,
                'r_pompiste_s_night': 1,
                'r_caissier_s_morning': 2,
                'r_caissier_s_afternoon': 2,
                'r_caissier_s_night': 1,
                'r_manager_s_morning': 1
            },
            weekend: {
                'r_pompiste_s_morning': 3,
                'r_pompiste_s_afternoon': 3,
                'r_pompiste_s_night': 1,
                'r_caissier_s_morning': 2,
                'r_caissier_s_afternoon': 2,
                'r_caissier_s_night': 1
            },
            holiday: {
                'r_pompiste_s_morning': 2,
                'r_pompiste_s_afternoon': 2,
                'r_pompiste_s_night': 1,
                'r_caissier_s_morning': 1,
                'r_caissier_s_afternoon': 1,
                'r_caissier_s_night': 1
            }
        },
        templates: [], // [{ id, name, description, shifts, createdAt }]
        holidays: [], // [{ date, name }]
        settings: {
            stdHoursWeek: 35,
            minRest: 11,
            mealBreak: 30,
            hourCost: 12
        }
    };
}

const DEFAULT_STATE = {
    stations: { 'st_default': defaultStationData('Ma station') },
    currentStationId: 'st_default',
    currentWeekStart: null,
    currentMonth: null
};

let state = loadState();

// ============== UTILS ==============
function uid(prefix = 'id') { return prefix + '_' + Math.random().toString(36).slice(2, 11); }

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return structuredClone(DEFAULT_STATE);
        const parsed = JSON.parse(raw);
        // Merge for forward compat
        const merged = Object.assign(structuredClone(DEFAULT_STATE), parsed);
        // Ensure each station has all fields
        Object.values(merged.stations).forEach(s => {
            const def = defaultStationData(s.name);
            for (const k in def) {
                if (s[k] == null) s[k] = def[k];
            }
            if (!s.settings) s.settings = def.settings;
            else s.settings = Object.assign({}, def.settings, s.settings);
            // Migration shiftTypes ancien format (start/end direct) -> nouveau (schedules par jour)
            if (s.shiftTypes) {
                s.shiftTypes.forEach(st => {
                    if (!st.schedules && st.start && st.end) {
                        st.schedules = {
                            weekday: { enabled: true, start: st.start, end: st.end },
                            weekend: { enabled: true, start: st.start, end: st.end },
                            holiday: { enabled: true, start: st.start, end: st.end }
                        };
                        delete st.start;
                        delete st.end;
                    }
                });
            }
        });
        return merged;
    } catch (e) {
        console.warn('Error loading state', e);
        return structuredClone(DEFAULT_STATE);
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        toast('Erreur de sauvegarde locale: ' + e.message, 'error');
    }
    // Pousser vers le cloud si connecté
    if (Cloud.connected && !Cloud.syncing) {
        Cloud.push();
    }
}

// Raccourci pour la station courante
function S() { return state.stations[state.currentStationId]; }

function getMonday(d = new Date()) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
}

function formatDate(d) {
    // Utilise les composants locaux pour éviter les décalages de timezone
    // (toISOString() convertit en UTC ce qui cause un décalage de jour selon le fuseau)
    const dd = new Date(d);
    const y = dd.getFullYear();
    const m = String(dd.getMonth() + 1).padStart(2, '0');
    const day = String(dd.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDateFR(d, opts = {}) {
    return new Date(d).toLocaleDateString('fr-FR', opts);
}

function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

function diffDays(d1, d2) {
    return Math.round((new Date(d2) - new Date(d1)) / 86400000);
}

function timeToMin(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function shiftDuration(start, end, breakMin = 0) {
    if (!start || !end) return 0;
    let s = timeToMin(start);
    let e = timeToMin(end);
    if (e <= s) e += 24 * 60;
    return Math.max(0, (e - s - breakMin) / 60);
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

function initials(name) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('') || '?';
}

function parseLocalDate(dateStr) {
    // Parse 'YYYY-MM-DD' comme une date locale (pas UTC) pour éviter les décalages
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function dayIndexFromDate(dateStr) {
    // 0=lundi ... 6=dimanche
    return (parseLocalDate(dateStr).getDay() + 6) % 7;
}

function isWeekend(dateStr) {
    const d = dayIndexFromDate(dateStr);
    return d >= 5;
}

function isHoliday(dateStr) {
    return S().holidays.some(h => h.date === dateStr);
}

function getDayType(dateStr) {
    if (isHoliday(dateStr)) return 'holiday';
    if (isWeekend(dateStr)) return 'weekend';
    return 'weekday';
}

// Renvoie l'horaire d'un shift type pour un jour donné, ou null si désactivé ce jour
function getShiftSchedule(shiftType, dateStr) {
    if (!shiftType || !shiftType.schedules) return null;
    const dayType = getDayType(dateStr);
    const sch = shiftType.schedules[dayType];
    if (!sch || !sch.enabled) return null;
    return { start: sch.start, end: sch.end };
}

// Pour l'affichage : renvoie une chaîne "06:00-14:00" la plus représentative (semaine en priorité)
function getShiftDisplayTime(shiftType) {
    if (!shiftType || !shiftType.schedules) return '';
    const sch = shiftType.schedules.weekday || shiftType.schedules.weekend || shiftType.schedules.holiday;
    if (sch && sch.enabled) return `${sch.start}-${sch.end}`;
    return '';
}

function toast(message, type = 'info', duration = 3000) {
    const c = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    c.appendChild(el);
    setTimeout(() => {
        el.classList.add('fade-out');
        setTimeout(() => el.remove(), 300);
    }, duration);
}

// ============== INIT ==============
function init() {
    if (!state.currentWeekStart) {
        state.currentWeekStart = formatDate(getMonday());
    } else {
        // Vérifier que la date sauvegardée tombe un lundi
        const parsed = parseLocalDate(state.currentWeekStart);
        const day = parsed.getDay(); // 0=dim, 1=lun, ..., 6=sam
        if (day !== 1) {
            // Cas typique du bug timezone : dans une timezone UTC+ (ex: Réunion +4),
            // une date "lundi 00h locale" → toISOString → "dimanche 20h UTC" → stockée comme "dimanche".
            // Si la date stockée est un dimanche, c'est très probablement le lundi SUIVANT.
            // Pour les autres jours, on prend le lundi de la même semaine ISO.
            let correctedMonday;
            if (day === 0) {
                // Dimanche → lundi suivant (cas du bug timezone UTC+)
                correctedMonday = new Date(parsed);
                correctedMonday.setDate(correctedMonday.getDate() + 1);
            } else {
                // Autres cas → lundi précédent dans la même semaine
                correctedMonday = getMonday(parsed);
            }
            const before = state.currentWeekStart;
            state.currentWeekStart = formatDate(correctedMonday);
            console.log('[FIX] Date semaine corrigée:', before, '→', state.currentWeekStart);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
        }
    }
    if (!state.currentMonth) {
        const t = new Date();
        state.currentMonth = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`;
    }
    if (S().employees.length === 0) {
        // Démarrage : ajouter quelques employés démo
        seedDemoData();
    }
    saveState();

    setupNavigation();
    setupStationSelector();
    setupPlanningEvents();
    setupMonthEvents();
    setupCoverageEvents();
    setupEmployeeEvents();
    setupLeaveEvents();
    setupSettingsEvents();
    setupTemplateEvents();
    setupModalEvents();
    setupExportImport();
    setupCloudEvents();
    renderAll();

    // Init du cloud après tout le reste (pour que les renderAll fonctionnent quand le cloud notifie)
    Cloud.init();
}

function seedDemoData() {
    const s = S();
    s.employees = [
        { id: 'e1', name: 'Marie Dubois', role: 'r_manager', secondaryRoles: ['r_caissier'], color: '#3b82f6', hoursPerWeek: 39, leavesPerYear: 25, rttRemaining: 5, phone: '06 12 34 56 78', email: 'marie@station.fr', availableDays: [0,1,2,3,4], shiftPrefs: { 's_morning': 'must', 's_afternoon': 'neutral', 's_night': 'impossible' }, contract: 'CDI', hireDate: '2020-03-15', birthday: '1985-06-20', notes: '', hourCost: null },
        { id: 'e2', name: 'Lucas Martin', role: 'r_pompiste', secondaryRoles: ['r_caissier'], color: '#10b981', hoursPerWeek: 35, leavesPerYear: 25, rttRemaining: 0, phone: '06 23 45 67 89', email: 'lucas@station.fr', availableDays: [0,1,2,3,4,5,6], shiftPrefs: { 's_morning': 'prefer', 's_afternoon': 'neutral', 's_night': 'avoid' }, contract: 'CDI', hireDate: '2022-01-10', birthday: '', notes: '', hourCost: null },
        { id: 'e3', name: 'Sophie Bernard', role: 'r_caissier', secondaryRoles: [], color: '#f59e0b', hoursPerWeek: 30, leavesPerYear: 25, rttRemaining: 0, phone: '06 34 56 78 90', email: 'sophie@station.fr', availableDays: [1,2,3,4,5,6], shiftPrefs: { 's_morning': 'avoid', 's_afternoon': 'must', 's_night': 'impossible' }, contract: 'CDI', hireDate: '2021-09-01', birthday: '', notes: 'Préfère après-midi pour raisons familiales', hourCost: null },
        { id: 'e4', name: 'Thomas Petit', role: 'r_pompiste', secondaryRoles: ['r_caissier'], color: '#8b5cf6', hoursPerWeek: 35, leavesPerYear: 25, rttRemaining: 0, phone: '06 45 67 89 01', email: 'thomas@station.fr', availableDays: [0,2,3,4,5,6], shiftPrefs: { 's_morning': 'neutral', 's_afternoon': 'prefer', 's_night': 'must' }, contract: 'CDI', hireDate: '2019-06-12', birthday: '', notes: '', hourCost: null },
        { id: 'e5', name: 'Emma Rousseau', role: 'r_pompiste', secondaryRoles: [], color: '#ef4444', hoursPerWeek: 35, leavesPerYear: 25, rttRemaining: 0, phone: '06 56 78 90 12', email: 'emma@station.fr', availableDays: [0,1,2,3,4,5,6], shiftPrefs: { 's_morning': 'prefer', 's_afternoon': 'prefer', 's_night': 'avoid' }, contract: 'CDI', hireDate: '2023-04-01', birthday: '', notes: '', hourCost: null },
        { id: 'e6', name: 'Hugo Moreau', role: 'r_caissier', secondaryRoles: ['r_pompiste'], color: '#06b6d4', hoursPerWeek: 35, leavesPerYear: 25, rttRemaining: 0, phone: '06 67 89 01 23', email: 'hugo@station.fr', availableDays: [0,1,2,3,4,5,6], shiftPrefs: { 's_morning': 'neutral', 's_afternoon': 'prefer', 's_night': 'neutral' }, contract: 'CDI', hireDate: '2022-11-05', birthday: '', notes: '', hourCost: null }
    ];
}

function renderAll() {
    renderStationSelector();
    renderPlanning();
    renderMonth();
    renderCoverage();
    renderEmployees();
    renderLeaves();
    renderAlerts();
    renderStats();
    renderTemplates();
    renderSettings();
    updateBadges();
}

function updateBadges() {
    const pending = S().leaves.filter(l => l.status === 'en_attente').length;
    const badge1 = document.getElementById('badgeLeaves');
    if (pending > 0) {
        badge1.textContent = pending;
        badge1.classList.remove('hidden');
    } else {
        badge1.classList.add('hidden');
    }

    const alerts = computeAlerts();
    const badge2 = document.getElementById('badgeAlerts');
    if (alerts.length > 0) {
        badge2.textContent = alerts.length;
        badge2.classList.remove('hidden');
    } else {
        badge2.classList.add('hidden');
    }
}

// ============== NAVIGATION ==============
function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
}

function switchView(view) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-' + view).classList.remove('hidden');
    if (view === 'stats') renderStats();
    if (view === 'leaves') renderLeaves();
    if (view === 'alerts') renderAlerts();
    if (view === 'coverage') renderCoverage();
    if (view === 'month') renderMonth();
    if (view === 'templates') renderTemplates();
    if (view === 'settings') renderSettings();
}

// ============== STATIONS ==============
function setupStationSelector() {
    document.getElementById('stationSelect').addEventListener('change', e => {
        state.currentStationId = e.target.value;
        saveState();
        renderAll();
    });
    document.getElementById('addStationBtn').addEventListener('click', () => {
        document.getElementById('newStationName').value = '';
        document.getElementById('stationModal').classList.remove('hidden');
    });
    document.getElementById('confirmStationBtn').addEventListener('click', () => {
        const name = document.getElementById('newStationName').value.trim();
        if (!name) { toast('Nom requis', 'error'); return; }
        const id = uid('st');
        state.stations[id] = defaultStationData(name);
        state.currentStationId = id;
        saveState();
        closeModal('stationModal');
        renderAll();
        toast('Station "' + name + '" créée', 'success');
    });
}

function renderStationSelector() {
    const sel = document.getElementById('stationSelect');
    sel.innerHTML = Object.entries(state.stations)
        .map(([id, s]) => `<option value="${id}" ${id === state.currentStationId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`)
        .join('');
}


// ============== PLANNING WEEKLY ==============
function setupPlanningEvents() {
    document.getElementById('prevWeek').addEventListener('click', () => navigateWeek(-7));
    document.getElementById('nextWeek').addEventListener('click', () => navigateWeek(7));
    document.getElementById('todayBtn').addEventListener('click', () => {
        state.currentWeekStart = formatDate(getMonday());
        saveState();
        renderPlanning();
    });
    document.getElementById('copyWeekBtn').addEventListener('click', copyWeek);
    document.getElementById('clearWeekBtn').addEventListener('click', clearWeek);
    document.getElementById('autoFillBtn').addEventListener('click', autoFillWeek);
    document.getElementById('saveTemplateBtn').addEventListener('click', () => openTemplateSaveModal());
    document.getElementById('applyTemplateBtn').addEventListener('click', () => openApplyTemplateModal());

    document.getElementById('searchEmp').addEventListener('input', () => renderPlanning());
    document.getElementById('filterRole').addEventListener('change', () => renderPlanning());
}

function navigateWeek(days) {
    const d = parseLocalDate(state.currentWeekStart);
    d.setDate(d.getDate() + days);
    state.currentWeekStart = formatDate(d);
    saveState();
    renderPlanning();
}

function getWeekDates() {
    const start = parseLocalDate(state.currentWeekStart);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function getEmployeeAvailability(emp, dateStr) {
    // Renvoie l'état de dispo pour un jour : 'available' | 'unavailable' | 'on_leave'
    if (isOnLeave(emp.id, dateStr)) return 'on_leave';
    const dayIdx = dayIndexFromDate(dateStr);
    if (emp.availableDays && emp.availableDays.length > 0 && !emp.availableDays.includes(dayIdx)) return 'unavailable';
    return 'available';
}

function getShiftPref(emp, shiftTypeId) {
    // Renvoie la préférence de l'employé pour un shift type
    if (!emp.shiftPrefs) return 'neutral';
    return emp.shiftPrefs[shiftTypeId] || 'neutral';
}

function isOnLeave(empId, dateStr) {
    return S().leaves.find(l =>
        l.employeeId === empId &&
        l.status === 'approuve' &&
        dateStr >= l.start && dateStr <= l.end
    );
}

function renderPlanning() {
    const grid = document.getElementById('planningGrid');
    const weekDates = getWeekDates();
    const today = formatDate(new Date());
    const search = document.getElementById('searchEmp')?.value.toLowerCase() || '';
    const filterRole = document.getElementById('filterRole')?.value || '';
    const s = S();

    // Filter rôle dropdown
    const filterRoleSel = document.getElementById('filterRole');
    if (filterRoleSel) {
        const cur = filterRoleSel.value;
        filterRoleSel.innerHTML = '<option value="">Tous les postes</option>' +
            s.roles.map(r => `<option value="${r.id}" ${cur === r.id ? 'selected' : ''}>${r.icon || ''} ${escapeHtml(r.name)}</option>`).join('');
    }

    // Update week label
    const start = weekDates[0], end = weekDates[6];
    document.getElementById('weekLabel').textContent =
        `${start.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} → ${end.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}`;

    // Header row
    let html = '<div class="grid-header">Employé</div>';
    const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

    weekDates.forEach((d, i) => {
        const dStr = formatDate(d);
        const isToday = dStr === today;
        const wknd = i >= 5;
        const holiday = s.holidays.find(h => h.date === dStr);
        const cls = `grid-header day-header${isToday ? ' today' : ''}${wknd ? ' weekend' : ''}${holiday ? ' holiday' : ''}`;
        html += `<div class="${cls}">
            <div class="day-name">${dayNames[i]}</div>
            <div class="day-date">${d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</div>
            ${holiday ? `<div class="holiday-name">${escapeHtml(holiday.name)}</div>` : ''}
        </div>`;
    });

    // Filtrer employés
    const employees = s.employees.filter(emp => {
        if (search && !emp.name.toLowerCase().includes(search)) return false;
        if (filterRole) {
            if (emp.role !== filterRole && !(emp.secondaryRoles || []).includes(filterRole)) return false;
        }
        return true;
    });

    // Lignes employés
    employees.forEach(emp => {
        const weekHours = computeWeekHours(emp.id, weekDates);
        const target = emp.hoursPerWeek;
        let hoursClass = 'hours-ok';
        if (weekHours > target * 1.05) hoursClass = 'hours-over';
        else if (weekHours < target * 0.95) hoursClass = 'hours-warn';

        const role = s.roles.find(r => r.id === emp.role);
        const roleLabel = role ? `${role.icon || ''} ${role.name}` : 'Sans poste';

        html += `<div class="employee-cell">
            <div class="employee-avatar" style="background:${emp.color}">${initials(emp.name)}</div>
            <div>
                <div class="employee-name">${escapeHtml(emp.name)}</div>
                <div class="employee-meta"><span class="${hoursClass}">${weekHours.toFixed(1)}h / ${target}h</span></div>
                <div class="role-badge">${roleLabel}</div>
            </div>
        </div>`;

        weekDates.forEach((d, i) => {
            const dateStr = formatDate(d);
            const key = emp.id + '_' + dateStr;
            const shift = s.shifts[key];
            const onLeave = isOnLeave(emp.id, dateStr);
            const isToday = dateStr === today;
            const wknd = i >= 5;
            const holiday = isHoliday(dateStr);
            const avail = getEmployeeAvailability(emp, dateStr);

            let cellClass = 'shift-cell';
            if (isToday) cellClass += ' today';
            if (wknd) cellClass += ' weekend';
            if (holiday) cellClass += ' holiday';
            if (avail === 'unavailable') cellClass += ' unavailable';

            // Préférences visibles si vide et dispo
            if (!shift && !onLeave && avail === 'available') {
                // Préférence principale = celle du shift type le plus matchant... on prend la "must" sinon "prefer"...
                // Simplification : on n'affiche pas la pref dans la cellule pour ne pas surcharger
            }

            let cellContent = '';

            if (onLeave) {
                let typeLabel = '';
                let blockClass = 'leave';
                if (onLeave.type === 'maladie') { typeLabel = '🤒 Maladie'; blockClass = 'sick'; }
                else if (onLeave.type === 'formation') { typeLabel = '📚 Formation'; blockClass = 'training'; }
                else if (onLeave.type === 'conges') typeLabel = '🏖️ Congé';
                else if (onLeave.type === 'rtt') typeLabel = '⏰ RTT';
                else typeLabel = '📅 ' + onLeave.type;
                cellContent = `<div class="shift-block ${blockClass}">
                    <div class="shift-time">${typeLabel}</div>
                    ${onLeave.note ? `<div class="shift-note">${escapeHtml(onLeave.note)}</div>` : ''}
                </div>`;
            } else if (shift) {
                if (shift.type === 'absence') {
                    cellContent = `<div class="shift-block absence">
                        <div class="shift-time">⚠️ Absence</div>
                        ${shift.note ? `<div class="shift-note">${escapeHtml(shift.note)}</div>` : ''}
                    </div>`;
                } else {
                    const dur = shiftDuration(shift.start, shift.end, shift.breakMin || 0);
                    const shiftType = s.shiftTypes.find(t => t.id === shift.type);
                    const color = shiftType ? shiftType.color : emp.color;
                    const role = s.roles.find(r => r.id === shift.role);
                    cellContent = `<div class="shift-block" draggable="true" data-key="${key}" style="background:${color}">
                        <div class="shift-time">${shift.start} - ${shift.end}</div>
                        <div class="shift-name">${shiftType ? escapeHtml(shiftType.name) : 'Custom'}</div>
                        ${role ? `<div class="shift-role">${role.icon || ''} ${escapeHtml(role.name)}</div>` : ''}
                        ${shift.note ? `<div class="shift-note">${escapeHtml(shift.note)}</div>` : ''}
                        <div class="shift-hours">${dur.toFixed(1)}h</div>
                    </div>`;
                }
            } else {
                cellClass += ' empty';
                if (avail === 'unavailable') {
                    cellContent = '<div style="opacity:0.4;text-align:center;padding-top:24px;font-size:10px">Indispo</div>';
                }
            }

            html += `<div class="${cellClass}" data-employee="${emp.id}" data-date="${dateStr}">${cellContent}</div>`;
        });
    });

    grid.innerHTML = html;

    // Click handlers pour cellules
    grid.querySelectorAll('.shift-cell').forEach(cell => {
        cell.addEventListener('click', () => openShiftModal(cell.dataset.employee, cell.dataset.date));
    });

    // Drag & drop
    setupDragDrop(grid);

    // Bandeau de couverture en haut
    renderCoverageStrip(weekDates);
}

function setupDragDrop(grid) {
    let draggedKey = null;

    grid.querySelectorAll('.shift-block[draggable="true"]').forEach(block => {
        block.addEventListener('dragstart', e => {
            draggedKey = block.dataset.key;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedKey);
            block.style.opacity = '0.5';
        });
        block.addEventListener('dragend', () => {
            block.style.opacity = '1';
            grid.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
        });
    });

    grid.querySelectorAll('.shift-cell').forEach(cell => {
        cell.addEventListener('dragover', e => {
            e.preventDefault();
            cell.classList.add('drag-over');
        });
        cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
        cell.addEventListener('drop', e => {
            e.preventDefault();
            cell.classList.remove('drag-over');
            if (!draggedKey) return;
            const newKey = cell.dataset.employee + '_' + cell.dataset.date;
            if (newKey === draggedKey) return;
            const s = S();
            const sh = s.shifts[draggedKey];
            if (!sh) return;
            // Si destination déjà occupée, demander confirmation
            if (s.shifts[newKey] && !confirm('La cellule destination est déjà occupée. Remplacer ?')) return;
            s.shifts[newKey] = sh;
            delete s.shifts[draggedKey];
            saveState();
            renderPlanning();
            renderCoverage();
            renderAlerts();
            updateBadges();
            toast('Shift déplacé', 'success');
            draggedKey = null;
        });
    });
}

function renderCoverageStrip(weekDates) {
    const strip = document.getElementById('coverageStrip');
    const s = S();
    let html = '<div class="coverage-strip-label">Couverture</div>';

    weekDates.forEach(d => {
        const dStr = formatDate(d);
        const cov = computeCoverageForDate(dStr);
        let cls = 'ok';
        let icon = '✓';
        if (cov.missing > 0) { cls = 'danger'; icon = '⚠️'; }
        else if (cov.warning > 0) { cls = 'warn'; icon = '⚠'; }
        const tooltip = cov.missing > 0
            ? `Il manque ${cov.missing} personne(s)`
            : 'Tous les minimums sont couverts';
        html += `<div class="coverage-day-summary ${cls}" title="${tooltip}">
            <div class="icon">${icon}</div>
            <div class="count">${cov.assigned}/${cov.required}</div>
        </div>`;
    });
    strip.innerHTML = html;
}

function computeWeekHours(empId, weekDates) {
    const s = S();
    let total = 0;
    weekDates.forEach(d => {
        const key = empId + '_' + formatDate(d);
        const sh = s.shifts[key];
        if (sh && sh.start && sh.end && sh.type !== 'absence') {
            total += shiftDuration(sh.start, sh.end, sh.breakMin || 0);
        }
    });
    return total;
}

function copyWeek() {
    if (!confirm('Copier le planning de cette semaine vers la semaine suivante ?')) return;
    const weekDates = getWeekDates();
    const s = S();
    let count = 0;
    weekDates.forEach(d => {
        s.employees.forEach(emp => {
            const oldKey = emp.id + '_' + formatDate(d);
            const newDate = formatDate(addDays(d, 7));
            const newKey = emp.id + '_' + newDate;
            if (s.shifts[oldKey] && !s.shifts[newKey]) {
                s.shifts[newKey] = { ...s.shifts[oldKey] };
                count++;
            }
        });
    });
    saveState();
    navigateWeek(7);
    toast(`${count} shift(s) copié(s)`, 'success');
}

function clearWeek() {
    if (!confirm('Supprimer tous les shifts de cette semaine ?')) return;
    const weekDates = getWeekDates();
    const s = S();
    let count = 0;
    weekDates.forEach(d => {
        s.employees.forEach(emp => {
            const key = emp.id + '_' + formatDate(d);
            if (s.shifts[key]) {
                delete s.shifts[key];
                count++;
            }
        });
    });
    saveState();
    renderPlanning();
    renderCoverage();
    renderAlerts();
    updateBadges();
    toast(`${count} shift(s) supprimé(s)`, 'success');
}

// ============== AUTO-FILL ==============
function autoFillWeek() {
    if (!confirm("Remplir automatiquement la semaine en respectant minimums, préférences et disponibilités ?")) return;
    const weekDates = getWeekDates();
    const s = S();
    let assignments = 0;

    // Initialiser le tracking d'heures par employé
    const empHours = {};
    s.employees.forEach(e => empHours[e.id] = computeWeekHours(e.id, weekDates));

    // Pour chaque jour
    weekDates.forEach((d, dayIdx) => {
        const dateStr = formatDate(d);
        const dayType = getDayType(dateStr);
        const reqs = s.requirements[dayType] || {};

        // Pour chaque combinaison rôle/shift requise
        for (const reqKey in reqs) {
            const need = reqs[reqKey];
            if (need <= 0) continue;
            const [roleId, shiftId] = reqKey.split('_').reduce((acc, part, i, arr) => {
                // roleId commence par 'r_', shiftId par 's_'
                if (part === 'r' || part === 's') return acc;
                if (acc.length === 0) return [arr.slice(0, 2).join('_')];
                return [acc[0], arr.slice(2).join('_')];
            }, []);
            // Plus simple : split sur le premier '_s_'
            const parts = reqKey.split('_s_');
            const roleIdClean = parts[0];
            const shiftIdClean = 's_' + parts[1];

            const shiftType = s.shiftTypes.find(st => st.id === shiftIdClean);
            if (!shiftType) continue;
            // Récupère l'horaire pour ce type de jour ; si désactivé, skip
            const sched = getShiftSchedule(shiftType, dateStr);
            if (!sched) continue;

            // Compter les déjà affectés sur ce shift+rôle ce jour
            let assigned = 0;
            s.employees.forEach(e => {
                const sh = s.shifts[e.id + '_' + dateStr];
                if (sh && sh.type === shiftIdClean && sh.role === roleIdClean) assigned++;
            });
            const missing = need - assigned;
            if (missing <= 0) continue;

            // Trouver candidats qui peuvent ce rôle, qui sont dispo, sous quota
            const candidates = s.employees
                .filter(e => {
                    // Doit avoir le rôle ou rôle secondaire
                    if (e.role !== roleIdClean && !(e.secondaryRoles || []).includes(roleIdClean)) return false;
                    // Disponible
                    if (getEmployeeAvailability(e, dateStr) !== 'available') return false;
                    // Pas déjà affecté ce jour
                    if (s.shifts[e.id + '_' + dateStr]) return false;
                    // Pas trop d'heures
                    const dur = shiftDuration(sched.start, sched.end);
                    if (empHours[e.id] + dur > e.hoursPerWeek + 4) return false;
                    // Pas en pref impossible
                    if (getShiftPref(e, shiftIdClean) === 'impossible') return false;
                    return true;
                })
                .map(e => {
                    // Score: priorité aux must / prefer
                    const pref = getShiftPref(e, shiftIdClean);
                    const prefScore = pref === 'must' ? 100 : pref === 'prefer' ? 30 : pref === 'avoid' ? -40 : 0;
                    const hoursScore = -((empHours[e.id] / e.hoursPerWeek) * 10); // les moins chargés en premier
                    const roleScore = e.role === roleIdClean ? 5 : 0; // poste principal préféré
                    return { emp: e, score: prefScore + hoursScore + roleScore };
                })
                .sort((a, b) => b.score - a.score);

            for (let n = 0; n < missing && n < candidates.length; n++) {
                const e = candidates[n].emp;
                s.shifts[e.id + '_' + dateStr] = {
                    type: shiftIdClean,
                    role: roleIdClean,
                    start: sched.start,
                    end: sched.end,
                    breakMin: shiftDuration(sched.start, sched.end) >= 6 ? s.settings.mealBreak : 0,
                    note: ''
                };
                empHours[e.id] += shiftDuration(sched.start, sched.end);
                assignments++;
            }
        }
    });

    saveState();
    renderPlanning();
    renderCoverage();
    renderAlerts();
    updateBadges();

    if (assignments > 0) {
        toast(`✨ Auto-remplissage: ${assignments} shifts assignés`, 'success');
    } else {
        toast('Aucun shift n\'a pu être assigné automatiquement', 'warning');
    }

    // Vérifier ce qui manque
    const alerts = computeAlerts().filter(a => a.type === 'understaffed');
    if (alerts.length > 0) {
        toast(`⚠️ ${alerts.length} jour(s) en sous-effectif. Voir Alertes.`, 'warning', 5000);
    }
}


// ============== COVERAGE COMPUTATION ==============
function computeCoverageForDate(dateStr) {
    const s = S();
    const dayType = getDayType(dateStr);
    const reqs = s.requirements[dayType] || {};

    let required = 0, assigned = 0, missing = 0, warning = 0;
    const details = [];

    for (const reqKey in reqs) {
        const need = reqs[reqKey];
        if (need <= 0) continue;
        const parts = reqKey.split('_s_');
        const roleId = parts[0];
        const shiftId = 's_' + parts[1];

        // Ignorer si le shift est désactivé pour ce type de jour
        const shiftType = s.shiftTypes.find(t => t.id === shiftId);
        if (!shiftType || !getShiftSchedule(shiftType, dateStr)) continue;

        let count = 0;
        s.employees.forEach(e => {
            const sh = s.shifts[e.id + '_' + dateStr];
            if (sh && sh.type === shiftId && sh.role === roleId) count++;
        });

        required += need;
        assigned += Math.min(count, need);
        const m = need - count;
        if (m > 0) missing += m;

        details.push({ roleId, shiftId, need, count, missing: Math.max(0, m) });
    }
    return { required, assigned, missing, warning, details };
}

function setupCoverageEvents() {
    document.getElementById('editRequirementsBtn').addEventListener('click', openRequirementsModal);
    document.getElementById('saveRequirementsBtn').addEventListener('click', saveRequirements);

    document.querySelectorAll('.req-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.req-tab').forEach(t => t.classList.toggle('active', t === tab));
            renderRequirementsTable(tab.dataset.dayType);
        });
    });
}

function renderCoverage() {
    const grid = document.getElementById('coverageGrid');
    const weekDates = getWeekDates();
    const s = S();

    grid.innerHTML = weekDates.map(d => {
        const dateStr = formatDate(d);
        const cov = computeCoverageForDate(dateStr);
        const dayType = getDayType(dateStr);
        const dayLabel = ['Semaine','Weekend','Férié'][['weekday','weekend','holiday'].indexOf(dayType)];

        let statusCls = 'ok', statusTxt = 'Couvert';
        if (cov.missing > 0) { statusCls = 'danger'; statusTxt = `Manque ${cov.missing}`; }

        const rowsHtml = cov.details.map(det => {
            const role = s.roles.find(r => r.id === det.roleId);
            const shift = s.shiftTypes.find(t => t.id === det.shiftId);
            if (!role || !shift) return '';
            const sched = getShiftSchedule(shift, dateStr);
            if (!sched) return ''; // shift désactivé ce jour
            let cls = 'ok';
            if (det.missing > 0) cls = 'danger';
            return `<div class="coverage-row">
                <div class="role">${role.icon || ''} ${escapeHtml(role.name)}</div>
                <div class="shift-info">${escapeHtml(shift.name)} · ${sched.start}-${sched.end}</div>
                <div class="count ${cls}">${det.count}/${det.need}</div>
            </div>`;
        }).join('');

        return `<div class="coverage-card">
            <div class="coverage-card-header">
                <div>
                    <div class="coverage-card-title">${d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</div>
                    <div class="coverage-card-date">${dayLabel}</div>
                </div>
                <span class="coverage-card-status ${statusCls}">${statusTxt}</span>
            </div>
            ${rowsHtml || '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Aucun minimum requis ce jour.</div>'}
        </div>`;
    }).join('');
}

function openRequirementsModal() {
    document.getElementById('requirementsModal').classList.remove('hidden');
    renderRequirementsTable('weekday');
    document.querySelectorAll('.req-tab').forEach(t => t.classList.toggle('active', t.dataset.dayType === 'weekday'));
}

function renderRequirementsTable(dayType) {
    const s = S();
    const reqs = s.requirements[dayType] || {};
    const table = document.getElementById('reqTable');

    let html = '<thead><tr><th>Poste \\ Shift</th>';
    s.shiftTypes.forEach(st => {
        const sch = st.schedules?.[dayType];
        const timeLabel = (sch && sch.enabled) ? `${sch.start}-${sch.end}` : '✗ désactivé ce jour';
        html += `<th>${escapeHtml(st.name)}<br><span style="font-weight:400;color:var(--text-dim);font-size:10px;font-family:'JetBrains Mono',monospace">${timeLabel}</span></th>`;
    });
    html += '</tr></thead><tbody>';

    s.roles.forEach(role => {
        html += `<tr><td>${role.icon || ''} ${escapeHtml(role.name)}</td>`;
        s.shiftTypes.forEach(st => {
            const key = role.id + '_' + st.id;
            const val = reqs[key] || 0;
            const sch = st.schedules?.[dayType];
            const disabled = !sch || !sch.enabled;
            html += `<td><input type="number" min="0" max="50" value="${val}" data-key="${key}" data-day-type="${dayType}" ${disabled ? 'disabled style="opacity:0.3"' : ''}></td>`;
        });
        html += '</tr>';
    });
    html += '</tbody>';
    table.innerHTML = html;
}

function saveRequirements() {
    const s = S();
    document.querySelectorAll('#reqTable input[type="number"]').forEach(input => {
        const dayType = input.dataset.dayType;
        const key = input.dataset.key;
        if (!s.requirements[dayType]) s.requirements[dayType] = {};
        const v = parseInt(input.value) || 0;
        s.requirements[dayType][key] = v;
    });
    saveState();
    closeModal('requirementsModal');
    renderCoverage();
    renderPlanning();
    renderAlerts();
    updateBadges();
    toast('Minimums enregistrés', 'success');
}

// ============== ALERTS ==============
function computeAlerts() {
    const alerts = [];
    const s = S();
    const weekDates = getWeekDates();

    // 1) Couverture insuffisante
    weekDates.forEach(d => {
        const dateStr = formatDate(d);
        const cov = computeCoverageForDate(dateStr);
        if (cov.missing > 0) {
            cov.details.forEach(det => {
                if (det.missing > 0) {
                    const role = s.roles.find(r => r.id === det.roleId);
                    const shift = s.shiftTypes.find(t => t.id === det.shiftId);
                    if (!role || !shift) return;
                    alerts.push({
                        type: 'understaffed',
                        severity: 'danger',
                        date: dateStr,
                        title: `Sous-effectif : ${role.name} · ${shift.name}`,
                        desc: `${d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} : il manque ${det.missing} ${role.name.toLowerCase()}(s) sur le shift ${shift.name} (${det.count}/${det.need} affecté(s))`
                    });
                }
            });
        }
    });

    // 2) Conflits : double affectation déjà gérée par la structure (clé unique).
    // Mais on peut détecter les heures qui se chevauchent (rare dans cette structure).

    // 3) Repos minimum non respecté
    const minRest = s.settings.minRest || 11;
    for (let i = 0; i < weekDates.length - 1; i++) {
        const dateStr1 = formatDate(weekDates[i]);
        const dateStr2 = formatDate(weekDates[i+1]);
        s.employees.forEach(emp => {
            const sh1 = s.shifts[emp.id + '_' + dateStr1];
            const sh2 = s.shifts[emp.id + '_' + dateStr2];
            if (sh1 && sh2 && sh1.end && sh2.start && sh1.type !== 'absence' && sh2.type !== 'absence') {
                // Calculer pause entre fin du shift1 et début shift2
                let endMin = timeToMin(sh1.end);
                let startMin = timeToMin(sh2.start);
                let diffMin;
                if (endMin < timeToMin(sh1.start)) {
                    // shift de nuit, fin le jour suivant
                    diffMin = startMin - endMin;
                } else {
                    diffMin = (24 * 60 - endMin) + startMin;
                }
                const restH = diffMin / 60;
                if (restH < minRest) {
                    alerts.push({
                        type: 'rest',
                        severity: 'warning',
                        title: `Repos insuffisant : ${emp.name}`,
                        desc: `Entre ${weekDates[i].toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'})} et ${weekDates[i+1].toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'})}, repos de ${restH.toFixed(1)}h (minimum ${minRest}h requis)`
                    });
                }
            }
        });
    }

    // 4) Heures supp / sous-quota
    s.employees.forEach(emp => {
        const h = computeWeekHours(emp.id, weekDates);
        if (h > emp.hoursPerWeek * 1.15) {
            alerts.push({
                type: 'overtime',
                severity: 'warning',
                title: `Heures supp importantes : ${emp.name}`,
                desc: `${h.toFixed(1)}h cette semaine (contrat ${emp.hoursPerWeek}h, soit +${(h - emp.hoursPerWeek).toFixed(1)}h)`
            });
        } else if (h > 0 && h < emp.hoursPerWeek * 0.85) {
            alerts.push({
                type: 'undertime',
                severity: 'warning',
                title: `Sous-quota d'heures : ${emp.name}`,
                desc: `${h.toFixed(1)}h cette semaine (contrat ${emp.hoursPerWeek}h, soit ${(h - emp.hoursPerWeek).toFixed(1)}h)`
            });
        }
    });

    // 5) Préférences violées
    weekDates.forEach(d => {
        const dateStr = formatDate(d);
        s.employees.forEach(emp => {
            const sh = s.shifts[emp.id + '_' + dateStr];
            if (!sh || sh.type === 'absence') return;
            const pref = getShiftPref(emp, sh.type);
            if (pref === 'impossible') {
                alerts.push({
                    type: 'pref_violation',
                    severity: 'danger',
                    title: `Préférence violée : ${emp.name}`,
                    desc: `${d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} : assigné(e) sur un shift marqué "impossible"`
                });
            } else if (pref === 'avoid') {
                alerts.push({
                    type: 'pref_avoid',
                    severity: 'warning',
                    title: `Shift à éviter : ${emp.name}`,
                    desc: `${d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} : préférence "à éviter"`
                });
            }
        });
    });

    // 6) Demandes de congés en attente
    s.leaves.filter(l => l.status === 'en_attente').forEach(l => {
        const emp = s.employees.find(e => e.id === l.employeeId);
        if (!emp) return;
        alerts.push({
            type: 'pending_leave',
            severity: 'info',
            title: `Demande de congé en attente : ${emp.name}`,
            desc: `${l.start} → ${l.end} (${l.type})`
        });
    });

    // 7) Anniversaires à venir (7 jours)
    const today = new Date();
    s.employees.forEach(emp => {
        if (!emp.birthday) return;
        const bd = new Date(emp.birthday);
        const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (thisYear < today) thisYear.setFullYear(thisYear.getFullYear() + 1);
        const days = Math.round((thisYear - today) / 86400000);
        if (days >= 0 && days <= 7) {
            alerts.push({
                type: 'birthday',
                severity: 'info',
                title: `🎂 Anniversaire : ${emp.name}`,
                desc: days === 0 ? "Aujourd'hui !" : `Dans ${days} jour${days > 1 ? 's' : ''}`
            });
        }
    });

    return alerts;
}

function renderAlerts() {
    const c = document.getElementById('alertsContainer');
    const alerts = computeAlerts();

    if (alerts.length === 0) {
        c.innerHTML = `<div class="empty-state">
            <div style="font-size:48px;margin-bottom:12px">✓</div>
            <div style="font-size:18px;font-weight:600;color:var(--success)">Aucune alerte</div>
            <div style="margin-top:8px">Tout est en ordre pour la semaine en cours.</div>
        </div>`;
        return;
    }

    const icons = {
        understaffed: '⚠️', rest: '😴', overtime: '🕐', undertime: '⏰',
        pref_violation: '🚫', pref_avoid: '👎', pending_leave: '📨', birthday: '🎂',
        conflict: '💥'
    };

    c.innerHTML = alerts.map(a => `
        <div class="alert-item ${a.severity}">
            <div class="alert-icon">${icons[a.type] || '⚠️'}</div>
            <div class="alert-item-content">
                <div class="alert-item-title">${escapeHtml(a.title)}</div>
                <div class="alert-item-desc">${escapeHtml(a.desc)}</div>
            </div>
        </div>
    `).join('');
}


// ============== MONTH VIEW ==============
function setupMonthEvents() {
    document.getElementById('prevMonth').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => navigateMonth(1));
    document.getElementById('todayMonthBtn').addEventListener('click', () => {
        const t = new Date();
        state.currentMonth = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`;
        saveState();
        renderMonth();
    });
}

function navigateMonth(delta) {
    const [y, m] = state.currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    state.currentMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    saveState();
    renderMonth();
}

function renderMonth() {
    const grid = document.getElementById('monthGrid');
    const [y, m] = state.currentMonth.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0);
    const today = formatDate(new Date());

    document.getElementById('monthLabel').textContent = firstDay.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    // Calculer le premier lundi à afficher
    const startMonday = getMonday(firstDay);
    const cells = [];
    const totalDays = 42; // 6 semaines max
    for (let i = 0; i < totalDays; i++) {
        const d = addDays(startMonday, i);
        cells.push(d);
        if (d > lastDay && d.getDay() === 0) break;
    }

    let html = '';
    const dayNames = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    dayNames.forEach(n => html += `<div class="month-header">${n}</div>`);

    cells.forEach(d => {
        const dStr = formatDate(d);
        const isOutside = d.getMonth() !== m - 1;
        const isToday = dStr === today;
        const wknd = (d.getDay() === 0 || d.getDay() === 6);
        const holiday = isHoliday(dStr);
        let cls = 'month-cell';
        if (isOutside) cls += ' outside';
        if (isToday) cls += ' today';
        if (wknd) cls += ' weekend';
        if (holiday) cls += ' holiday';

        const s = S();
        const dayShifts = s.employees.flatMap(e => {
            const sh = s.shifts[e.id + '_' + dStr];
            if (sh && sh.type !== 'absence') return [{ emp: e, sh }];
            return [];
        });

        const cov = computeCoverageForDate(dStr);
        let covSegments = '';
        if (cov.required > 0) {
            const okCount = cov.assigned;
            const missCount = cov.missing;
            covSegments = '<div class="month-coverage-bar">';
            for (let i = 0; i < okCount; i++) covSegments += '<div class="month-coverage-segment"></div>';
            for (let i = 0; i < missCount; i++) covSegments += '<div class="month-coverage-segment danger"></div>';
            covSegments += '</div>';
        }

        const shiftsHtml = dayShifts.slice(0, 3).map(({ emp, sh }) => {
            const st = s.shiftTypes.find(t => t.id === sh.type);
            const color = st ? st.color : emp.color;
            return `<div class="month-mini-shift" style="background:${color}">${escapeHtml(emp.name.split(' ')[0])} ${sh.start}</div>`;
        }).join('');
        const remaining = dayShifts.length - 3;

        html += `<div class="${cls}" data-date="${dStr}">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <span class="month-day-num">${d.getDate()}</span>
                ${holiday ? '<span style="font-size:11px">🎉</span>' : ''}
            </div>
            ${covSegments}
            <div class="month-cell-shifts">${shiftsHtml}</div>
            ${remaining > 0 ? `<div class="month-cell-summary">+${remaining} autre(s)</div>` : ''}
            ${dayShifts.length === 0 && !isOutside ? '<div class="month-cell-summary">Aucun shift</div>' : ''}
        </div>`;
    });

    grid.innerHTML = html;

    grid.querySelectorAll('.month-cell:not(.outside)').forEach(cell => {
        cell.addEventListener('click', () => {
            // Aller à la semaine de la date cliquée
            const d = parseLocalDate(cell.dataset.date);
            state.currentWeekStart = formatDate(getMonday(d));
            saveState();
            switchView('planning');
        });
    });
}

// ============== EMPLOYEES MANAGEMENT ==============
let editingEmployeeId = null;

function setupEmployeeEvents() {
    document.getElementById('addEmployeeBtn').addEventListener('click', () => openEmployeeModal());
    document.getElementById('saveEmployeeBtn').addEventListener('click', saveEmployee);
    document.getElementById('deleteEmployeeBtn').addEventListener('click', deleteEmployee);

    // Tabs in modal
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t === tab));
            document.querySelectorAll('.modal-tab-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab.dataset.tab));
        });
    });
}

function renderEmployees() {
    const grid = document.getElementById('employeesGrid');
    const s = S();
    if (s.employees.length === 0) {
        grid.innerHTML = '<div class="empty-state">Aucun employé. Cliquez sur "Ajouter un employé".</div>';
        return;
    }

    const today = new Date();

    grid.innerHTML = s.employees.map(emp => {
        const leavesUsed = computeLeavesUsed(emp.id);
        const leavesRemaining = emp.leavesPerYear - leavesUsed;
        const remainClass = leavesRemaining < 0 ? 'danger' : leavesRemaining < 5 ? 'warning' : 'success';
        const last30 = computeLastDaysHours(emp.id, 30);
        const role = s.roles.find(r => r.id === emp.role);

        // Anniversaire proche ?
        let birthdayHtml = '';
        if (emp.birthday) {
            const bd = new Date(emp.birthday);
            const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
            if (thisYear < today) thisYear.setFullYear(thisYear.getFullYear() + 1);
            const days = Math.round((thisYear - today) / 86400000);
            if (days >= 0 && days <= 14) {
                birthdayHtml = `<div class="birthday-soon">🎂 Anniversaire ${days === 0 ? 'aujourd\'hui' : `dans ${days}j`}</div>`;
            }
        }

        return `<div class="employee-card" data-employee="${emp.id}" style="border-left-color:${emp.color}">
            <div class="employee-card-header">
                <div class="employee-avatar" style="background:${emp.color}">${initials(emp.name)}</div>
                <div>
                    <div class="employee-card-name">${escapeHtml(emp.name)}</div>
                    <div class="employee-card-role">${role ? (role.icon + ' ' + role.name) : 'Sans poste'}</div>
                </div>
            </div>
            <div class="employee-card-stats">
                <div class="stat-block">
                    <div class="stat-label">Heures / sem</div>
                    <div class="stat-value">${emp.hoursPerWeek}h</div>
                </div>
                <div class="stat-block">
                    <div class="stat-label">30 derniers j.</div>
                    <div class="stat-value">${last30.toFixed(0)}h</div>
                </div>
                <div class="stat-block">
                    <div class="stat-label">Congés pris</div>
                    <div class="stat-value">${leavesUsed}j</div>
                </div>
                <div class="stat-block">
                    <div class="stat-label">Restants</div>
                    <div class="stat-value ${remainClass}">${leavesRemaining}j</div>
                </div>
            </div>
            <div class="employee-card-contact">
                ${emp.contract ? `📋 ${emp.contract}` : ''}
                ${emp.phone ? `<br>📞 ${escapeHtml(emp.phone)}` : ''}
                ${emp.email ? `<br>✉️ ${escapeHtml(emp.email)}` : ''}
            </div>
            ${birthdayHtml}
        </div>`;
    }).join('');

    grid.querySelectorAll('.employee-card').forEach(card => {
        card.addEventListener('click', () => openEmployeeModal(card.dataset.employee));
    });

    // Update select options for leaves
    const sel = document.getElementById('leaveEmployee');
    if (sel) sel.innerHTML = s.employees.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
    const selFilter = document.getElementById('filterLeaveEmp');
    if (selFilter) {
        const cur = selFilter.value;
        selFilter.innerHTML = '<option value="">Tous les employés</option>' +
            s.employees.map(e => `<option value="${e.id}" ${cur === e.id ? 'selected' : ''}>${escapeHtml(e.name)}</option>`).join('');
    }
}

function computeLeavesUsed(empId) {
    let total = 0;
    S().leaves.forEach(l => {
        if (l.employeeId === empId && l.status === 'approuve' && (l.type === 'conges')) {
            total += diffDays(l.start, l.end) + 1;
        }
    });
    return total;
}

function computeLastDaysHours(empId, days) {
    const today = new Date();
    let total = 0;
    const s = S();
    for (let i = 0; i < days; i++) {
        const d = addDays(today, -i);
        const sh = s.shifts[empId + '_' + formatDate(d)];
        if (sh && sh.start && sh.end && sh.type !== 'absence') {
            total += shiftDuration(sh.start, sh.end, sh.breakMin || 0);
        }
    }
    return total;
}

function openEmployeeModal(id = null) {
    editingEmployeeId = id;
    const s = S();
    const isEdit = !!id;
    document.getElementById('employeeModalTitle').textContent = isEdit ? "Modifier l'employé" : 'Nouvel employé';
    document.getElementById('deleteEmployeeBtn').classList.toggle('hidden', !isEdit);

    // Reset à l'onglet général
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'general'));
    document.querySelectorAll('.modal-tab-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === 'general'));

    // Populate role select
    const roleSel = document.getElementById('empRole');
    roleSel.innerHTML = s.roles.map(r => `<option value="${r.id}">${r.icon || ''} ${escapeHtml(r.name)}</option>`).join('');

    // Populate secondary roles checkboxes
    const secMulti = document.getElementById('empSecondaryRoles');
    secMulti.innerHTML = s.roles.map(r => `
        <label><input type="checkbox" value="${r.id}"> ${r.icon || ''} ${escapeHtml(r.name)}</label>
    `).join('');

    // Populate shift prefs
    renderShiftPrefs(isEdit ? s.employees.find(e => e.id === id)?.shiftPrefs || {} : {});

    if (isEdit) {
        const e = s.employees.find(emp => emp.id === id);
        document.getElementById('empName').value = e.name || '';
        document.getElementById('empBirthday').value = e.birthday || '';
        document.getElementById('empRole').value = e.role || s.roles[0]?.id || '';
        document.getElementById('empColor').value = e.color || '#3b82f6';
        document.getElementById('empContract').value = e.contract || 'CDI';
        document.getElementById('empHireDate').value = e.hireDate || '';
        document.getElementById('empHours').value = e.hoursPerWeek || 35;
        document.getElementById('empHourCost').value = e.hourCost ?? '';
        document.getElementById('empLeaves').value = e.leavesPerYear || 25;
        document.getElementById('empRtt').value = e.rttRemaining || 0;
        document.getElementById('empPhone').value = e.phone || '';
        document.getElementById('empEmail').value = e.email || '';
        document.getElementById('empNotes').value = e.notes || '';
        document.querySelectorAll('#empDays input').forEach(cb => {
            cb.checked = (e.availableDays || []).includes(parseInt(cb.value));
        });
        secMulti.querySelectorAll('input').forEach(cb => {
            cb.checked = (e.secondaryRoles || []).includes(cb.value);
        });
    } else {
        document.getElementById('empName').value = '';
        document.getElementById('empBirthday').value = '';
        document.getElementById('empRole').value = s.roles[0]?.id || '';
        document.getElementById('empColor').value = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
        document.getElementById('empContract').value = 'CDI';
        document.getElementById('empHireDate').value = formatDate(new Date());
        document.getElementById('empHours').value = 35;
        document.getElementById('empHourCost').value = '';
        document.getElementById('empLeaves').value = 25;
        document.getElementById('empRtt').value = 0;
        document.getElementById('empPhone').value = '';
        document.getElementById('empEmail').value = '';
        document.getElementById('empNotes').value = '';
        document.querySelectorAll('#empDays input').forEach(cb => cb.checked = true);
        secMulti.querySelectorAll('input').forEach(cb => cb.checked = false);
    }
    document.getElementById('employeeModal').classList.remove('hidden');
}

function renderShiftPrefs(currentPrefs) {
    const s = S();
    const c = document.getElementById('empShiftPrefs');
    c.innerHTML = s.shiftTypes.map(st => {
        const pref = currentPrefs[st.id] || 'neutral';
        return `<div class="pref-shift-row" data-shift="${st.id}">
            <div class="pref-shift-info">
                <div class="pref-shift-color" style="background:${st.color}"></div>
                <div>
                    <div class="pref-shift-name">${escapeHtml(st.name)}</div>
                    <div class="pref-shift-time">${getShiftDisplayTime(st)}</div>
                </div>
            </div>
            <div class="pref-buttons">
                <button class="pref-btn must ${pref === 'must' ? 'active' : ''}" data-pref="must" title="Doit">✅</button>
                <button class="pref-btn prefer ${pref === 'prefer' ? 'active' : ''}" data-pref="prefer" title="Préfère">👍</button>
                <button class="pref-btn neutral ${pref === 'neutral' ? 'active' : ''}" data-pref="neutral" title="Neutre">➖</button>
                <button class="pref-btn avoid ${pref === 'avoid' ? 'active' : ''}" data-pref="avoid" title="Éviter">👎</button>
                <button class="pref-btn impossible ${pref === 'impossible' ? 'active' : ''}" data-pref="impossible" title="Impossible">🚫</button>
            </div>
        </div>`;
    }).join('');

    c.querySelectorAll('.pref-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = btn.closest('.pref-shift-row');
            row.querySelectorAll('.pref-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function saveEmployee() {
    const s = S();
    const name = document.getElementById('empName').value.trim();
    if (!name) { toast('Le nom est requis', 'error'); return; }

    // Récupérer les préférences
    const shiftPrefs = {};
    document.querySelectorAll('#empShiftPrefs .pref-shift-row').forEach(row => {
        const shiftId = row.dataset.shift;
        const active = row.querySelector('.pref-btn.active');
        shiftPrefs[shiftId] = active ? active.dataset.pref : 'neutral';
    });

    const data = {
        name,
        birthday: document.getElementById('empBirthday').value,
        role: document.getElementById('empRole').value,
        secondaryRoles: Array.from(document.querySelectorAll('#empSecondaryRoles input:checked')).map(cb => cb.value),
        color: document.getElementById('empColor').value,
        contract: document.getElementById('empContract').value,
        hireDate: document.getElementById('empHireDate').value,
        hoursPerWeek: parseInt(document.getElementById('empHours').value) || 35,
        hourCost: document.getElementById('empHourCost').value ? parseFloat(document.getElementById('empHourCost').value) : null,
        leavesPerYear: parseInt(document.getElementById('empLeaves').value) || 25,
        rttRemaining: parseInt(document.getElementById('empRtt').value) || 0,
        phone: document.getElementById('empPhone').value.trim(),
        email: document.getElementById('empEmail').value.trim(),
        notes: document.getElementById('empNotes').value.trim(),
        availableDays: Array.from(document.querySelectorAll('#empDays input:checked')).map(cb => parseInt(cb.value)),
        shiftPrefs
    };

    if (editingEmployeeId) {
        const idx = s.employees.findIndex(e => e.id === editingEmployeeId);
        s.employees[idx] = { ...s.employees[idx], ...data };
        toast('Employé modifié', 'success');
    } else {
        s.employees.push({ id: uid('e'), ...data });
        toast('Employé ajouté', 'success');
    }

    saveState();
    closeModal('employeeModal');
    renderEmployees();
    renderPlanning();
    renderCoverage();
    renderAlerts();
    updateBadges();
}

function deleteEmployee() {
    if (!editingEmployeeId) return;
    if (!confirm('Supprimer cet employé ? Tous ses shifts et congés seront supprimés.')) return;
    const s = S();
    s.employees = s.employees.filter(e => e.id !== editingEmployeeId);
    Object.keys(s.shifts).forEach(k => {
        if (k.startsWith(editingEmployeeId + '_')) delete s.shifts[k];
    });
    s.leaves = s.leaves.filter(l => l.employeeId !== editingEmployeeId);
    saveState();
    closeModal('employeeModal');
    renderAll();
    toast('Employé supprimé', 'success');
}


// ============== SHIFT MODAL (cellule) ==============
let editingShiftKey = null;

function openShiftModal(empId, dateStr) {
    const s = S();
    const emp = s.employees.find(e => e.id === empId);
    if (!emp) return;
    editingShiftKey = empId + '_' + dateStr;

    const role = s.roles.find(r => r.id === emp.role);
    document.getElementById('shiftEmployeeInfo').innerHTML = `<span style="color:${emp.color}">●</span> ${escapeHtml(emp.name)} ${role ? '(' + role.icon + ' ' + role.name + ')' : ''}`;
    document.getElementById('shiftDateInfo').textContent = parseLocalDate(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Shift types select - n'affiche que les shifts actifs ce jour-là
    const shiftSel = document.getElementById('shiftType');
    const opts = ['<option value="">-- Personnalisé --</option>'];
    s.shiftTypes.forEach(t => {
        const sched = getShiftSchedule(t, dateStr);
        if (sched) {
            opts.push(`<option value="${t.id}">${escapeHtml(t.name)} (${sched.start} - ${sched.end})</option>`);
        } else {
            opts.push(`<option value="${t.id}" disabled>${escapeHtml(t.name)} (désactivé ce jour)</option>`);
        }
    });
    opts.push('<option value="absence">⚠️ Marquer comme absent</option>');
    shiftSel.innerHTML = opts.join('');

    // Role select
    const roleSel = document.getElementById('shiftRole');
    const empRoles = [emp.role, ...(emp.secondaryRoles || [])].filter(Boolean);
    roleSel.innerHTML = empRoles.map(rid => {
        const r = s.roles.find(x => x.id === rid);
        return r ? `<option value="${r.id}">${r.icon || ''} ${escapeHtml(r.name)}</option>` : '';
    }).join('');

    const existing = s.shifts[editingShiftKey];
    if (existing) {
        shiftSel.value = existing.type || '';
        roleSel.value = existing.role || emp.role || '';
        document.getElementById('shiftStart').value = existing.start || '';
        document.getElementById('shiftEnd').value = existing.end || '';
        document.getElementById('shiftBreak').value = existing.breakMin || 0;
        document.getElementById('shiftNote').value = existing.note || '';
        document.getElementById('deleteShiftBtn').style.display = '';
        document.getElementById('shiftModalTitle').textContent = 'Modifier le shift';
    } else {
        shiftSel.value = '';
        roleSel.value = emp.role || '';
        document.getElementById('shiftStart').value = '';
        document.getElementById('shiftEnd').value = '';
        document.getElementById('shiftBreak').value = 0;
        document.getElementById('shiftNote').value = '';
        document.getElementById('deleteShiftBtn').style.display = 'none';
        document.getElementById('shiftModalTitle').textContent = 'Affecter un shift';
    }

    checkShiftAlerts(empId, dateStr);
    document.getElementById('shiftModal').classList.remove('hidden');
}

function checkShiftAlerts(empId, dateStr) {
    const s = S();
    const alertEl = document.getElementById('shiftAlert');
    const emp = s.employees.find(e => e.id === empId);
    const messages = [];

    const leave = isOnLeave(empId, dateStr);
    if (leave) messages.push(`⚠️ Cet employé est en ${leave.type} du ${leave.start} au ${leave.end}`);

    const dayIdx = dayIndexFromDate(dateStr);
    if (emp.availableDays && emp.availableDays.length > 0 && !emp.availableDays.includes(dayIdx)) {
        messages.push(`⚠️ Cet employé n'est pas disponible ce jour selon ses dispos`);
    }

    // Pref check au changement de type
    const shiftSel = document.getElementById('shiftType');
    const newType = shiftSel.value;
    if (newType && newType !== 'absence') {
        const pref = getShiftPref(emp, newType);
        if (pref === 'impossible') messages.push(`🚫 Préférence: cet employé NE PEUT PAS travailler ce shift`);
        else if (pref === 'avoid') messages.push(`👎 Préférence: cet employé préfère éviter ce shift`);
        else if (pref === 'must') messages.push(`✅ Préférence: cet employé doit travailler ce shift`);
        else if (pref === 'prefer') messages.push(`👍 Préférence: cet employé préfère ce shift`);
    }

    if (messages.length > 0) {
        alertEl.innerHTML = messages.join('<br>');
        alertEl.className = 'alert warning';
    } else {
        alertEl.classList.add('hidden');
    }
}

function setupModalEvents() {
    document.querySelectorAll('[data-close-modal]').forEach(b => {
        b.addEventListener('click', () => closeModal(b.dataset.closeModal));
    });
    document.querySelectorAll('.modal-overlay').forEach(o => {
        o.addEventListener('click', e => {
            if (e.target === o) closeModal(o.id);
        });
    });

    document.getElementById('shiftType').addEventListener('change', e => {
        // Récupérer la date depuis editingShiftKey
        const idx = editingShiftKey.lastIndexOf('_');
        const eId = editingShiftKey.slice(0, idx);
        const dStr = editingShiftKey.slice(idx + 1);

        const t = S().shiftTypes.find(x => x.id === e.target.value);
        if (t) {
            const sched = getShiftSchedule(t, dStr);
            if (sched) {
                document.getElementById('shiftStart').value = sched.start;
                document.getElementById('shiftEnd').value = sched.end;
                const dur = shiftDuration(sched.start, sched.end);
                if (dur >= 6) document.getElementById('shiftBreak').value = S().settings.mealBreak || 30;
            }
        }
        checkShiftAlerts(eId, dStr);
    });

    document.getElementById('saveShiftBtn').addEventListener('click', saveShift);
    document.getElementById('deleteShiftBtn').addEventListener('click', deleteShift);
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function saveShift() {
    if (!editingShiftKey) return;
    const s = S();
    const type = document.getElementById('shiftType').value;
    const role = document.getElementById('shiftRole').value;
    const start = document.getElementById('shiftStart').value;
    const end = document.getElementById('shiftEnd').value;
    const breakMin = parseInt(document.getElementById('shiftBreak').value || 0);
    const note = document.getElementById('shiftNote').value.trim();

    if (type === 'absence') {
        s.shifts[editingShiftKey] = { type: 'absence', note };
    } else {
        if (!start || !end) { toast('Heures de début et fin requises', 'error'); return; }
        s.shifts[editingShiftKey] = { type: type || 'custom', role, start, end, breakMin, note };
    }
    saveState();
    closeModal('shiftModal');
    renderPlanning();
    renderCoverage();
    renderAlerts();
    updateBadges();
    toast('Shift enregistré', 'success');
}

function deleteShift() {
    if (!editingShiftKey) return;
    delete S().shifts[editingShiftKey];
    saveState();
    closeModal('shiftModal');
    renderPlanning();
    renderCoverage();
    renderAlerts();
    updateBadges();
    toast('Shift supprimé', 'success');
}

// ============== LEAVES ==============
let editingLeaveId = null;

function setupLeaveEvents() {
    document.getElementById('addLeaveBtn').addEventListener('click', () => openLeaveModal());
    document.getElementById('saveLeaveBtn').addEventListener('click', saveLeave);
    document.getElementById('deleteLeaveBtn').addEventListener('click', deleteLeave);
    document.getElementById('filterLeaveStatus').addEventListener('change', renderLeaves);
    document.getElementById('filterLeaveEmp').addEventListener('change', renderLeaves);
}

function renderLeaves() {
    const s = S();
    const summary = document.getElementById('leavesSummary');
    const enAttente = s.leaves.filter(l => l.status === 'en_attente').length;
    const approuves = s.leaves.filter(l => l.status === 'approuve').length;
    const refuses = s.leaves.filter(l => l.status === 'refuse').length;

    let totalRestants = 0, totalPris = 0;
    s.employees.forEach(e => {
        const used = computeLeavesUsed(e.id);
        totalPris += used;
        totalRestants += (e.leavesPerYear - used);
    });

    summary.innerHTML = `
        <div class="summary-card warning"><div class="summary-label">En attente</div><div class="summary-value">${enAttente}</div></div>
        <div class="summary-card success"><div class="summary-label">Approuvés</div><div class="summary-value">${approuves}</div></div>
        <div class="summary-card danger"><div class="summary-label">Refusés</div><div class="summary-value">${refuses}</div></div>
        <div class="summary-card"><div class="summary-label">Jours pris</div><div class="summary-value">${totalPris}j</div></div>
        <div class="summary-card success"><div class="summary-label">Jours restants</div><div class="summary-value">${totalRestants}j</div></div>
    `;

    const filterStatus = document.getElementById('filterLeaveStatus').value;
    const filterEmp = document.getElementById('filterLeaveEmp').value;

    let leaves = [...s.leaves];
    if (filterStatus) leaves = leaves.filter(l => l.status === filterStatus);
    if (filterEmp) leaves = leaves.filter(l => l.employeeId === filterEmp);
    leaves.sort((a, b) => (b.start || '').localeCompare(a.start || ''));

    const list = document.getElementById('leavesList');
    if (leaves.length === 0) {
        list.innerHTML = '<div class="empty-state">Aucune demande de congé.</div>';
        return;
    }

    list.innerHTML = leaves.map(l => {
        const emp = s.employees.find(e => e.id === l.employeeId);
        if (!emp) return '';
        const dur = diffDays(l.start, l.end) + 1;
        return `<div class="leave-item" data-leave="${l.id}">
            <div class="leave-employee">
                <span style="color:${emp.color}">●</span> ${escapeHtml(emp.name)}
            </div>
            <div class="leave-type">${escapeHtml(l.type.replace('sansolde','sans solde'))}</div>
            <div class="leave-dates">${l.start} → ${l.end}</div>
            <div class="leave-duration">${dur} jour${dur > 1 ? 's' : ''}</div>
            <div><span class="status-badge status-${l.status}">${l.status.replace('_', ' ')}</span></div>
            <div style="text-align:right;color:var(--text-muted);font-size:11px">${l.note ? '📝' : ''}</div>
        </div>`;
    }).join('');

    list.querySelectorAll('.leave-item').forEach(item => {
        item.addEventListener('click', () => openLeaveModal(item.dataset.leave));
    });
}

function openLeaveModal(id = null) {
    editingLeaveId = id;
    const s = S();
    document.getElementById('leaveModalTitle').textContent = id ? 'Modifier la demande' : 'Nouvelle demande de congé';
    document.getElementById('deleteLeaveBtn').classList.toggle('hidden', !id);

    const sel = document.getElementById('leaveEmployee');
    sel.innerHTML = s.employees.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');

    if (id) {
        const l = s.leaves.find(x => x.id === id);
        sel.value = l.employeeId;
        document.getElementById('leaveType').value = l.type;
        document.getElementById('leaveStart').value = l.start;
        document.getElementById('leaveEnd').value = l.end;
        document.getElementById('leaveStatus').value = l.status;
        document.getElementById('leaveNote').value = l.note || '';
    } else {
        const today = formatDate(new Date());
        document.getElementById('leaveType').value = 'conges';
        document.getElementById('leaveStart').value = today;
        document.getElementById('leaveEnd').value = today;
        document.getElementById('leaveStatus').value = 'en_attente';
        document.getElementById('leaveNote').value = '';
    }
    document.getElementById('leaveModal').classList.remove('hidden');
}

function saveLeave() {
    const s = S();
    const employeeId = document.getElementById('leaveEmployee').value;
    const type = document.getElementById('leaveType').value;
    const start = document.getElementById('leaveStart').value;
    const end = document.getElementById('leaveEnd').value;
    const status = document.getElementById('leaveStatus').value;
    const note = document.getElementById('leaveNote').value.trim();

    if (!employeeId || !start || !end) { toast('Tous les champs sont requis', 'error'); return; }
    if (end < start) { toast('La date de fin doit être après le début', 'error'); return; }

    if (editingLeaveId) {
        const idx = s.leaves.findIndex(l => l.id === editingLeaveId);
        s.leaves[idx] = { ...s.leaves[idx], employeeId, type, start, end, status, note };
    } else {
        s.leaves.push({ id: uid('lv'), employeeId, type, start, end, status, note });
    }
    saveState();
    closeModal('leaveModal');
    renderLeaves();
    renderPlanning();
    renderEmployees();
    renderAlerts();
    updateBadges();
    toast('Demande enregistrée', 'success');
}

function deleteLeave() {
    if (!editingLeaveId) return;
    if (!confirm('Supprimer cette demande de congé ?')) return;
    const s = S();
    s.leaves = s.leaves.filter(l => l.id !== editingLeaveId);
    saveState();
    closeModal('leaveModal');
    renderAll();
    toast('Demande supprimée', 'success');
}


// ============== SETTINGS ==============
function setupSettingsEvents() {
    // Champs station courante
    document.getElementById('settingStationName').addEventListener('change', e => {
        S().name = e.target.value;
        saveState();
        renderStationSelector();
    });
    document.getElementById('settingAddress').addEventListener('change', e => {
        S().address = e.target.value;
        saveState();
    });

    // Règles
    document.getElementById('settingStdHours').addEventListener('change', e => {
        S().settings.stdHoursWeek = parseInt(e.target.value) || 35;
        saveState();
    });
    document.getElementById('settingRest').addEventListener('change', e => {
        S().settings.minRest = parseInt(e.target.value) || 11;
        saveState();
        renderAlerts();
        updateBadges();
    });
    document.getElementById('settingMealBreak').addEventListener('change', e => {
        S().settings.mealBreak = parseInt(e.target.value) || 30;
        saveState();
    });
    document.getElementById('settingHourCost').addEventListener('change', e => {
        S().settings.hourCost = parseFloat(e.target.value) || 12;
        saveState();
        renderStats();
    });

    // Boutons d'ajout
    document.getElementById('addShiftBtn').addEventListener('click', () => openShiftSettingModal());
    document.getElementById('addRoleBtn').addEventListener('click', () => openRoleSettingModal());
    document.getElementById('addHolidayBtn').addEventListener('click', () => openHolidayModal());
    document.getElementById('autoHolidaysBtn').addEventListener('click', loadFrenchHolidays);
    document.getElementById('deleteStationBtn').addEventListener('click', deleteCurrentStation);
    document.getElementById('resetDataBtn').addEventListener('click', resetAllData);

    // Save handlers
    document.getElementById('saveShiftSettingBtn').addEventListener('click', saveShiftSetting);
    document.getElementById('deleteShiftSettingBtn').addEventListener('click', deleteShiftSetting);
    document.getElementById('saveRoleBtn').addEventListener('click', saveRoleSetting);
    document.getElementById('deleteRoleBtn').addEventListener('click', deleteRoleSetting);
    document.getElementById('saveHolidayBtn').addEventListener('click', saveHoliday);
}

function renderSettings() {
    const s = S();
    document.getElementById('settingStationName').value = s.name || '';
    document.getElementById('settingAddress').value = s.address || '';
    document.getElementById('settingStdHours').value = s.settings.stdHoursWeek || 35;
    document.getElementById('settingRest').value = s.settings.minRest || 11;
    document.getElementById('settingMealBreak').value = s.settings.mealBreak || 30;
    document.getElementById('settingHourCost').value = s.settings.hourCost || 12;

    renderHoursTable();
    renderShiftsList();
    renderRolesList();
    renderHolidaysList();
    renderSyncState();

    document.getElementById('deleteStationBtn').style.display =
        Object.keys(state.stations).length > 1 ? '' : 'none';
}

function renderHoursTable() {
    const s = S();
    const days = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
    const c = document.getElementById('hoursTable');
    c.innerHTML = days.map((name, i) => {
        const h = s.openingHours[i] || { open: true, start: '08:00', end: '20:00' };
        return `<div class="hours-row ${h.open ? '' : 'closed'}" data-day="${i}">
            <div class="day-label">${name}</div>
            <div><input type="time" value="${h.start}" data-field="start" ${h.open ? '' : 'disabled'}></div>
            <div><input type="time" value="${h.end}" data-field="end" ${h.open ? '' : 'disabled'}></div>
            <label class="closed-toggle"><input type="checkbox" ${h.open ? '' : 'checked'} data-field="closed"> Fermé</label>
        </div>`;
    }).join('');

    // Wire up
    c.querySelectorAll('.hours-row').forEach(row => {
        const day = parseInt(row.dataset.day);
        row.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => {
                const h = s.openingHours[day] || { open: true, start: '08:00', end: '20:00' };
                if (input.dataset.field === 'closed') {
                    h.open = !input.checked;
                    row.classList.toggle('closed', !h.open);
                    row.querySelectorAll('input[type="time"]').forEach(i => i.disabled = !h.open);
                } else if (input.dataset.field === 'start') {
                    h.start = input.value;
                } else if (input.dataset.field === 'end') {
                    h.end = input.value;
                }
                s.openingHours[day] = h;
                saveState();
            });
        });
    });
}

function renderShiftsList() {
    const s = S();
    const c = document.getElementById('shiftsList');
    c.innerHTML = s.shiftTypes.map(st => {
        const w = st.schedules?.weekday;
        const we = st.schedules?.weekend;
        const ho = st.schedules?.holiday;
        const fmt = (sch) => sch && sch.enabled ? `${sch.start}-${sch.end}` : '<span style="color:var(--danger)">✗</span>';
        return `
        <div class="shift-setting-item" data-id="${st.id}">
            <div class="shift-color-dot" style="background:${st.color}"></div>
            <div class="shift-setting-info">
                <div class="shift-setting-name">${escapeHtml(st.name)}</div>
                <div class="shift-setting-time">
                    <span title="Semaine">📅 ${fmt(w)}</span> &nbsp;
                    <span title="Weekend">🎈 ${fmt(we)}</span> &nbsp;
                    <span title="Férié">🎉 ${fmt(ho)}</span>
                </div>
            </div>
            <div class="shift-setting-actions">
                <button data-action="edit">Modifier</button>
            </div>
        </div>`;
    }).join('');

    // Légende des shifts (juste afficher horaires semaine en aperçu)
    const legend = document.getElementById('legendShifts');
    if (legend) {
        legend.innerHTML = s.shiftTypes.map(st => `
            <div class="legend-item">
                <span class="legend-color" style="background:${st.color}"></span>
                ${escapeHtml(st.name)} (${getShiftDisplayTime(st)})
            </div>
        `).join('');
    }

    c.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const id = btn.closest('.shift-setting-item').dataset.id;
            openShiftSettingModal(id);
        });
    });
}

let editingShiftSettingId = null;
function openShiftSettingModal(id = null) {
    editingShiftSettingId = id;
    const s = S();
    document.getElementById('shiftSettingTitle').textContent = id ? 'Modifier le shift' : 'Nouveau shift';
    document.getElementById('deleteShiftSettingBtn').classList.toggle('hidden', !id);

    const setSchedFields = (prefix, sch) => {
        document.getElementById(`sched${prefix}Enabled`).checked = sch.enabled;
        document.getElementById(`sched${prefix}Start`).value = sch.start;
        document.getElementById(`sched${prefix}End`).value = sch.end;
        document.getElementById(`sched${prefix}Start`).disabled = !sch.enabled;
        document.getElementById(`sched${prefix}End`).disabled = !sch.enabled;
    };

    if (id) {
        const st = s.shiftTypes.find(x => x.id === id);
        document.getElementById('shiftSetName').value = st.name;
        document.getElementById('shiftSetColor').value = st.color;
        const w = st.schedules?.weekday || { enabled: true, start: '08:00', end: '16:00' };
        const we = st.schedules?.weekend || { enabled: true, start: '08:00', end: '16:00' };
        const ho = st.schedules?.holiday || { enabled: true, start: '08:00', end: '16:00' };
        setSchedFields('Weekday', w);
        setSchedFields('Weekend', we);
        setSchedFields('Holiday', ho);
    } else {
        document.getElementById('shiftSetName').value = '';
        document.getElementById('shiftSetColor').value = '#3b82f6';
        const def = { enabled: true, start: '08:00', end: '16:00' };
        setSchedFields('Weekday', def);
        setSchedFields('Weekend', def);
        setSchedFields('Holiday', def);
    }

    // Wire up enabled checkboxes pour griser les inputs
    ['Weekday', 'Weekend', 'Holiday'].forEach(p => {
        const cb = document.getElementById(`sched${p}Enabled`);
        cb.onchange = () => {
            document.getElementById(`sched${p}Start`).disabled = !cb.checked;
            document.getElementById(`sched${p}End`).disabled = !cb.checked;
        };
    });

    // Bouton de copie
    const copyBtn = document.getElementById('copyWeekdayToWeekendBtn');
    copyBtn.onclick = () => {
        const wStart = document.getElementById('schedWeekdayStart').value;
        const wEnd = document.getElementById('schedWeekdayEnd').value;
        const wEnabled = document.getElementById('schedWeekdayEnabled').checked;
        ['Weekend', 'Holiday'].forEach(p => {
            document.getElementById(`sched${p}Enabled`).checked = wEnabled;
            document.getElementById(`sched${p}Start`).value = wStart;
            document.getElementById(`sched${p}End`).value = wEnd;
            document.getElementById(`sched${p}Start`).disabled = !wEnabled;
            document.getElementById(`sched${p}End`).disabled = !wEnabled;
        });
        toast('Horaires copiés', 'success');
    };

    document.getElementById('shiftSettingModal').classList.remove('hidden');
}

function saveShiftSetting() {
    const s = S();
    const name = document.getElementById('shiftSetName').value.trim();
    if (!name) { toast('Nom requis', 'error'); return; }

    const readSched = (prefix) => ({
        enabled: document.getElementById(`sched${prefix}Enabled`).checked,
        start: document.getElementById(`sched${prefix}Start`).value || '08:00',
        end: document.getElementById(`sched${prefix}End`).value || '16:00'
    });

    const data = {
        name,
        color: document.getElementById('shiftSetColor').value,
        schedules: {
            weekday: readSched('Weekday'),
            weekend: readSched('Weekend'),
            holiday: readSched('Holiday')
        }
    };

    if (editingShiftSettingId) {
        const idx = s.shiftTypes.findIndex(x => x.id === editingShiftSettingId);
        s.shiftTypes[idx] = { ...s.shiftTypes[idx], ...data };
    } else {
        s.shiftTypes.push({ id: uid('s'), ...data });
    }
    saveState();
    closeModal('shiftSettingModal');
    renderSettings();
    renderPlanning();
    renderCoverage();
    toast('Shift enregistré', 'success');
}

function deleteShiftSetting() {
    if (!editingShiftSettingId) return;
    if (!confirm('Supprimer ce shift ? Les affectations existantes garderont leurs horaires.')) return;
    const s = S();
    s.shiftTypes = s.shiftTypes.filter(x => x.id !== editingShiftSettingId);
    saveState();
    closeModal('shiftSettingModal');
    renderSettings();
    renderPlanning();
    toast('Shift supprimé', 'success');
}

function renderRolesList() {
    const s = S();
    const c = document.getElementById('rolesList');
    c.innerHTML = s.roles.map(r => `
        <div class="role-setting-item" data-id="${r.id}">
            <div class="role-color-dot" style="background:${r.color}"></div>
            <div class="role-setting-info">
                <div class="role-setting-name">${r.icon || ''} ${escapeHtml(r.name)}</div>
                <div class="role-setting-meta">${s.employees.filter(e => e.role === r.id).length} employé(s)</div>
            </div>
            <div class="role-setting-actions">
                <button data-action="edit">Modifier</button>
            </div>
        </div>
    `).join('');

    c.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const id = btn.closest('.role-setting-item').dataset.id;
            openRoleSettingModal(id);
        });
    });
}

let editingRoleId = null;
function openRoleSettingModal(id = null) {
    editingRoleId = id;
    const s = S();
    document.getElementById('roleSettingTitle').textContent = id ? 'Modifier le poste' : 'Nouveau poste';
    document.getElementById('deleteRoleBtn').classList.toggle('hidden', !id);

    if (id) {
        const r = s.roles.find(x => x.id === id);
        document.getElementById('roleSetName').value = r.name;
        document.getElementById('roleSetColor').value = r.color;
        document.getElementById('roleSetIcon').value = r.icon || '';
    } else {
        document.getElementById('roleSetName').value = '';
        document.getElementById('roleSetColor').value = '#3b82f6';
        document.getElementById('roleSetIcon').value = '';
    }
    document.getElementById('roleSettingModal').classList.remove('hidden');
}

function saveRoleSetting() {
    const s = S();
    const data = {
        name: document.getElementById('roleSetName').value.trim(),
        color: document.getElementById('roleSetColor').value,
        icon: document.getElementById('roleSetIcon').value.trim()
    };
    if (!data.name) { toast('Nom requis', 'error'); return; }

    if (editingRoleId) {
        const idx = s.roles.findIndex(x => x.id === editingRoleId);
        s.roles[idx] = { ...s.roles[idx], ...data };
    } else {
        s.roles.push({ id: uid('r'), ...data });
    }
    saveState();
    closeModal('roleSettingModal');
    renderSettings();
    renderPlanning();
    renderEmployees();
    toast('Poste enregistré', 'success');
}

function deleteRoleSetting() {
    if (!editingRoleId) return;
    const s = S();
    const used = s.employees.filter(e => e.role === editingRoleId).length;
    if (used > 0 && !confirm(`${used} employé(s) ont ce poste comme principal. Continuer ?`)) return;
    if (!confirm('Supprimer ce poste ?')) return;
    s.roles = s.roles.filter(x => x.id !== editingRoleId);
    // Nettoyer les minimums
    Object.keys(s.requirements).forEach(dt => {
        Object.keys(s.requirements[dt]).forEach(k => {
            if (k.startsWith(editingRoleId + '_')) delete s.requirements[dt][k];
        });
    });
    saveState();
    closeModal('roleSettingModal');
    renderAll();
    toast('Poste supprimé', 'success');
}

function renderHolidaysList() {
    const s = S();
    const c = document.getElementById('holidaysList');
    if (s.holidays.length === 0) {
        c.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px 0">Aucun jour férié configuré.</div>';
        return;
    }
    const sorted = [...s.holidays].sort((a, b) => a.date.localeCompare(b.date));
    c.innerHTML = sorted.map((h, idx) => `
        <div class="holiday-item">
            <div></div>
            <div>
                <strong style="font-size:12px">${escapeHtml(h.name)}</strong>
                <div style="font-size:11px;color:var(--text-muted)">${formatDateFR(h.date, {weekday:'short',day:'numeric',month:'long',year:'numeric'})}</div>
            </div>
            <button data-idx="${idx}">×</button>
        </div>
    `).join('');
    c.querySelectorAll('button[data-idx]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const date = sorted[parseInt(btn.dataset.idx)].date;
            S().holidays = S().holidays.filter(h => h.date !== date);
            saveState();
            renderHolidaysList();
            renderPlanning();
            renderMonth();
        });
    });
}

function openHolidayModal() {
    document.getElementById('holidayDate').value = formatDate(new Date());
    document.getElementById('holidayName').value = '';
    document.getElementById('holidayModal').classList.remove('hidden');
}

function saveHoliday() {
    const date = document.getElementById('holidayDate').value;
    const name = document.getElementById('holidayName').value.trim();
    if (!date || !name) { toast('Date et nom requis', 'error'); return; }
    const s = S();
    if (s.holidays.find(h => h.date === date)) {
        toast('Un férié existe déjà à cette date', 'warning');
        return;
    }
    s.holidays.push({ date, name });
    saveState();
    closeModal('holidayModal');
    renderHolidaysList();
    renderPlanning();
    renderMonth();
    toast('Férié ajouté', 'success');
}

function easterDate(year) {
    // Algorithme Anonyme Grégorien
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19*a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2*e + 2*i - h - k) % 7;
    const m = Math.floor((a + 11*h + 22*l) / 451);
    const month = Math.floor((h + l - 7*m + 114) / 31);
    const day = ((h + l - 7*m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

function loadFrenchHolidays() {
    const year = new Date().getFullYear();
    const easter = easterDate(year);
    const easterMonday = addDays(easter, 1);
    const ascension = addDays(easter, 39);
    const pentecost = addDays(easter, 50);

    const list = [
        { date: `${year}-01-01`, name: 'Jour de l\'an' },
        { date: formatDate(easterMonday), name: 'Lundi de Pâques' },
        { date: `${year}-05-01`, name: 'Fête du Travail' },
        { date: `${year}-05-08`, name: 'Victoire 1945' },
        { date: formatDate(ascension), name: 'Ascension' },
        { date: formatDate(pentecost), name: 'Lundi de Pentecôte' },
        { date: `${year}-07-14`, name: 'Fête nationale' },
        { date: `${year}-08-15`, name: 'Assomption' },
        { date: `${year}-11-01`, name: 'Toussaint' },
        { date: `${year}-11-11`, name: 'Armistice 1918' },
        { date: `${year}-12-25`, name: 'Noël' }
    ];
    const s = S();
    let added = 0;
    list.forEach(h => {
        if (!s.holidays.find(x => x.date === h.date)) {
            s.holidays.push(h);
            added++;
        }
    });
    saveState();
    renderHolidaysList();
    renderPlanning();
    renderMonth();
    toast(`${added} jour(s) férié(s) ajouté(s) pour ${year}`, 'success');
}

function deleteCurrentStation() {
    if (Object.keys(state.stations).length <= 1) {
        toast('Impossible de supprimer la dernière station', 'error');
        return;
    }
    if (!confirm(`Supprimer la station "${S().name}" ? Toutes ses données seront perdues.`)) return;
    delete state.stations[state.currentStationId];
    state.currentStationId = Object.keys(state.stations)[0];
    saveState();
    renderAll();
    toast('Station supprimée', 'success');
}

function resetAllData() {
    if (!confirm('⚠️ Supprimer TOUTES les données de TOUTES les stations ? Cette action est irréversible.')) return;
    if (!confirm('Vraiment sûr ? Pense à exporter une sauvegarde avant.')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
}

// ============== TEMPLATES ==============
function setupTemplateEvents() {
    document.getElementById('createTemplateBtn').addEventListener('click', openTemplateSaveModal);
    document.getElementById('confirmTemplateBtn').addEventListener('click', confirmSaveTemplate);
    document.getElementById('confirmApplyTemplateBtn').addEventListener('click', confirmApplyTemplate);
}

function renderTemplates() {
    const s = S();
    const grid = document.getElementById('templatesGrid');
    if (s.templates.length === 0) {
        grid.innerHTML = '<div class="empty-state">Aucun template sauvegardé.<br><br>Construis une semaine type, puis clique sur "Sauver semaine actuelle".</div>';
        return;
    }
    grid.innerHTML = s.templates.map(t => `
        <div class="template-card" data-id="${t.id}">
            <div class="template-card-name">${escapeHtml(t.name)}</div>
            <div class="template-card-desc">${escapeHtml(t.description || 'Pas de description')}</div>
            <div class="template-card-meta">
                <span>${Object.keys(t.shifts).length} shifts</span>
                <span>${formatDateFR(t.createdAt, {day:'numeric',month:'short',year:'numeric'})}</span>
            </div>
            <div class="template-card-actions">
                <button class="btn-primary" data-action="apply">Appliquer</button>
                <button class="btn-danger" data-action="delete">×</button>
            </div>
        </div>
    `).join('');

    grid.querySelectorAll('[data-action="apply"]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const id = btn.closest('.template-card').dataset.id;
            applyTemplate(id);
        });
    });
    grid.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const id = btn.closest('.template-card').dataset.id;
            if (!confirm('Supprimer ce template ?')) return;
            S().templates = S().templates.filter(t => t.id !== id);
            saveState();
            renderTemplates();
            toast('Template supprimé', 'success');
        });
    });
}

function openTemplateSaveModal() {
    const weekDates = getWeekDates();
    const s = S();
    let count = 0;
    weekDates.forEach(d => {
        s.employees.forEach(e => {
            if (s.shifts[e.id + '_' + formatDate(d)]) count++;
        });
    });
    document.getElementById('templateName').value = '';
    document.getElementById('templateDesc').value = '';
    document.getElementById('templateInfo').textContent = `${count} shift(s) seront sauvegardés depuis la semaine du ${weekDates[0].toLocaleDateString('fr-FR')}.`;
    document.getElementById('templateModal').classList.remove('hidden');
}

function confirmSaveTemplate() {
    const name = document.getElementById('templateName').value.trim();
    if (!name) { toast('Nom requis', 'error'); return; }
    const description = document.getElementById('templateDesc').value.trim();
    const weekDates = getWeekDates();
    const s = S();
    const templateShifts = {};

    weekDates.forEach((d, i) => {
        const dStr = formatDate(d);
        s.employees.forEach(e => {
            const sh = s.shifts[e.id + '_' + dStr];
            if (sh) {
                // Stocker avec offset jour (0-6) au lieu de date absolue
                templateShifts[e.id + '_d' + i] = { ...sh };
            }
        });
    });

    s.templates.push({
        id: uid('tpl'),
        name,
        description,
        shifts: templateShifts,
        createdAt: new Date().toISOString()
    });
    saveState();
    closeModal('templateModal');
    renderTemplates();
    toast('Template sauvegardé', 'success');
}

function openApplyTemplateModal() {
    const s = S();
    if (s.templates.length === 0) {
        toast('Aucun template disponible', 'warning');
        return;
    }
    const sel = document.getElementById('applyTemplateSelect');
    sel.innerHTML = s.templates.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    document.getElementById('applyTemplateModal').classList.remove('hidden');
}

function confirmApplyTemplate() {
    const id = document.getElementById('applyTemplateSelect').value;
    const clearFirst = document.getElementById('applyClearFirst').checked;
    closeModal('applyTemplateModal');
    applyTemplate(id, clearFirst);
}

function applyTemplate(id, clearFirst = true) {
    const s = S();
    const tpl = s.templates.find(t => t.id === id);
    if (!tpl) return;
    const weekDates = getWeekDates();

    if (clearFirst) {
        weekDates.forEach(d => {
            s.employees.forEach(e => {
                delete s.shifts[e.id + '_' + formatDate(d)];
            });
        });
    }

    let applied = 0;
    Object.entries(tpl.shifts).forEach(([key, sh]) => {
        // key format: "empId_dN"
        const m = key.match(/^(.+)_d(\d)$/);
        if (!m) return;
        const empId = m[1];
        const dayOffset = parseInt(m[2]);
        // Vérifier que l'employé existe encore
        if (!s.employees.find(e => e.id === empId)) return;
        const dStr = formatDate(weekDates[dayOffset]);
        s.shifts[empId + '_' + dStr] = { ...sh };
        applied++;
    });
    saveState();
    renderPlanning();
    renderCoverage();
    renderAlerts();
    updateBadges();
    toast(`Template appliqué : ${applied} shift(s)`, 'success');
}

// ============== STATS ==============
function renderStats() {
    const periodSel = document.getElementById('statsPeriod');
    if (!periodSel) return;
    const period = periodSel.value;
    periodSel.addEventListener('change', renderStats);

    const s = S();
    const today = new Date();
    let dates = [];
    if (period === 'week') {
        dates = getWeekDates();
    } else if (period === 'month') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            dates.push(new Date(d));
        }
    } else {
        for (let i = 0; i < 365; i++) dates.push(addDays(today, -i));
    }

    // Heures totales par employé
    let totalHours = 0;
    let totalCost = 0;
    let totalShifts = 0;
    const empHours = {};
    s.employees.forEach(e => empHours[e.id] = 0);

    dates.forEach(d => {
        const dStr = formatDate(d);
        s.employees.forEach(e => {
            const sh = s.shifts[e.id + '_' + dStr];
            if (sh && sh.start && sh.end && sh.type !== 'absence') {
                const h = shiftDuration(sh.start, sh.end, sh.breakMin || 0);
                empHours[e.id] += h;
                totalHours += h;
                totalShifts++;
                const cost = e.hourCost ?? s.settings.hourCost;
                totalCost += h * cost;
            }
        });
    });

    // Couverture moyenne sur la période
    let totalCovOk = 0, totalCovReq = 0;
    dates.forEach(d => {
        const cov = computeCoverageForDate(formatDate(d));
        totalCovReq += cov.required;
        totalCovOk += cov.assigned;
    });
    const coveragePct = totalCovReq > 0 ? Math.round((totalCovOk / totalCovReq) * 100) : 100;

    const days = dates.length;
    const c = document.getElementById('statsContainer');

    c.innerHTML = `
        <div class="stats-grid">
            <div class="kpi-card">
                <div class="kpi-label">Heures totales</div>
                <div class="kpi-value">${totalHours.toFixed(0)}h</div>
            </div>
            <div class="kpi-card success">
                <div class="kpi-label">Coût total estimé</div>
                <div class="kpi-value">${totalCost.toFixed(0)}€</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Shifts planifiés</div>
                <div class="kpi-value">${totalShifts}</div>
            </div>
            <div class="kpi-card ${coveragePct < 80 ? 'danger' : coveragePct < 95 ? 'warning' : 'success'}">
                <div class="kpi-label">Couverture</div>
                <div class="kpi-value">${coveragePct}%</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Heures moy / employé</div>
                <div class="kpi-value">${s.employees.length ? (totalHours / s.employees.length).toFixed(1) : 0}h</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Période</div>
                <div class="kpi-value" style="font-size:18px">${days}j</div>
            </div>
        </div>

        <div class="chart-card">
            <h3>Heures par employé</h3>
            ${s.employees.map(e => {
                const h = empHours[e.id];
                const target = period === 'week' ? e.hoursPerWeek : period === 'month' ? e.hoursPerWeek * 4.33 : e.hoursPerWeek * 52;
                const pct = Math.min(100, target > 0 ? (h / target) * 100 : 0);
                let cls = '';
                if (h > target * 1.05) cls = 'over';
                else if (h > 0 && h < target * 0.85) cls = 'under';
                return `<div class="bar-row">
                    <div class="bar-name">${escapeHtml(e.name)}</div>
                    <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
                    <div class="bar-value">${h.toFixed(1)}h / ${target.toFixed(0)}h</div>
                </div>`;
            }).join('')}
        </div>

        <div class="chart-card">
            <h3>Coût par employé</h3>
            ${s.employees.map(e => {
                const h = empHours[e.id];
                const cost = h * (e.hourCost ?? s.settings.hourCost);
                const maxCost = Math.max(...s.employees.map(x => empHours[x.id] * (x.hourCost ?? s.settings.hourCost)), 1);
                const pct = (cost / maxCost) * 100;
                return `<div class="bar-row">
                    <div class="bar-name">${escapeHtml(e.name)}</div>
                    <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
                    <div class="bar-value">${cost.toFixed(0)}€</div>
                </div>`;
            }).join('')}
        </div>
    `;
}

// ============== EXPORT / IMPORT / PRINT ==============
function setupExportImport() {
    document.getElementById('exportBtn').addEventListener('click', () => {
        const data = JSON.stringify(state, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `planning-station-${formatDate(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast('Sauvegarde exportée', 'success');
    });

    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const imported = JSON.parse(ev.target.result);
                if (!confirm('Remplacer toutes les données actuelles par celles du fichier ?')) return;
                // Migration v1 vers v2 : si format v1 détecté
                if (imported.employees && !imported.stations) {
                    const v2 = structuredClone(DEFAULT_STATE);
                    const s = v2.stations.st_default;
                    Object.assign(s, {
                        employees: imported.employees || [],
                        shifts: imported.shifts || {},
                        leaves: imported.leaves || [],
                        shiftTypes: imported.shiftTypes || s.shiftTypes,
                        roles: imported.roles || s.roles,
                        settings: { ...s.settings, ...(imported.settings || {}) }
                    });
                    state = v2;
                    toast('Données v1 migrées vers v2', 'success');
                } else {
                    state = imported;
                }
                saveState();
                location.reload();
            } catch (err) {
                toast('Fichier invalide: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    document.getElementById('printBtn').addEventListener('click', () => {
        switchView('planning');
        setTimeout(() => window.print(), 100);
    });
}

// ============== CLOUD SYNC EVENTS ==============
function setupCloudEvents() {
    const setupBtn = document.getElementById('setupCloudBtn');
    const disconnectBtn = document.getElementById('disconnectCloudBtn');
    const confirmBtn = document.getElementById('confirmCloudBtn');
    const syncStatus = document.getElementById('syncStatus');

    if (setupBtn) setupBtn.addEventListener('click', openCloudModal);
    if (syncStatus) syncStatus.addEventListener('click', () => {
        switchView('settings');
        document.getElementById('setupCloudBtn').scrollIntoView({ behavior: 'smooth' });
    });

    if (disconnectBtn) disconnectBtn.addEventListener('click', () => {
        if (!confirm('Déconnecter du cloud ? Tes données restent en local mais ne seront plus synchronisées.')) return;
        Cloud.disconnect();
        renderSyncState();
        toast('Déconnecté du cloud', 'success');
    });

    if (confirmBtn) confirmBtn.addEventListener('click', confirmCloudSetup);
}

function openCloudModal() {
    const cfg = Cloud.config || {};
    document.getElementById('fbApiKey').value = cfg.apiKey || '';
    document.getElementById('fbAuthDomain').value = cfg.authDomain || '';
    document.getElementById('fbDatabaseURL').value = cfg.databaseURL || '';
    document.getElementById('fbProjectId').value = cfg.projectId || '';
    document.getElementById('cloudModal').classList.remove('hidden');
}

async function confirmCloudSetup() {
    const config = {
        apiKey: document.getElementById('fbApiKey').value.trim(),
        authDomain: document.getElementById('fbAuthDomain').value.trim(),
        databaseURL: document.getElementById('fbDatabaseURL').value.trim(),
        projectId: document.getElementById('fbProjectId').value.trim()
    };

    if (!config.apiKey || !config.databaseURL) {
        toast('API Key et Database URL sont requis', 'error');
        return;
    }
    if (!config.databaseURL.startsWith('https://')) {
        toast('Database URL doit commencer par https://', 'error');
        return;
    }

    const action = document.getElementById('cloudInitAction').value;

    // Si on est déjà connecté, déconnecter d'abord
    if (Cloud.connected) Cloud.disconnect();

    // Sauver la config et tenter la connexion
    Cloud.saveConfig(config);
    const ok = await Cloud.connect();
    if (!ok) {
        toast('Connexion impossible. Vérifie tes clés.', 'error', 5000);
        return;
    }

    // Au premier setup, soit on push soit on pull
    if (action === 'push') {
        await Cloud.push();
        toast('☁️ Données envoyées vers le cloud', 'success');
    } else {
        const remote = await Cloud.pull();
        if (remote) {
            Cloud.applyRemoteData(remote);
            toast('☁️ Données récupérées du cloud', 'success');
        } else {
            // Pas de données distantes → push de ce qu'on a
            await Cloud.push();
            toast('☁️ Cloud vide, données locales envoyées', 'success');
        }
    }

    closeModal('cloudModal');
    renderSyncState();
}

function renderSyncState() {
    const div = document.getElementById('syncCurrentState');
    const disconnectBtn = document.getElementById('disconnectCloudBtn');
    const setupBtn = document.getElementById('setupCloudBtn');
    if (!div) return;

    if (Cloud.connected) {
        div.innerHTML = `
            <div class="alert success">
                <strong>✓ Connecté au cloud Firebase</strong><br>
                <span style="font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--text-muted)">${escapeHtml(Cloud.config.databaseURL)}</span>
                <br><br>
                <strong>Pour partager avec ton équipe :</strong><br>
                Donne-leur l'URL de cette page web. Ils verront automatiquement les mêmes données.
            </div>`;
        if (disconnectBtn) disconnectBtn.classList.remove('hidden');
        if (setupBtn) setupBtn.textContent = '🔧 Modifier la configuration';
    } else {
        div.innerHTML = `
            <div class="alert warning">
                <strong>Mode local uniquement</strong><br>
                Tes données sont stockées seulement dans ce navigateur.
                Pour partager avec ton équipe, configure Firebase ci-dessous.
            </div>`;
        if (disconnectBtn) disconnectBtn.classList.add('hidden');
        if (setupBtn) setupBtn.textContent = '🔧 Configurer la synchronisation';
    }
}

// ============== INIT ==============
document.addEventListener('DOMContentLoaded', init);
