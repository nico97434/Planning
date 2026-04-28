/* ============================================================
   PLANNING STATION-SERVICE
   Application complète de gestion de planning
   Persistance: localStorage  |  Aucune dépendance externe
   ============================================================ */

// ============== ÉTAT GLOBAL ==============
const STORAGE_KEY = 'planning_station_v1';

const DEFAULT_STATE = {
    employees: [
        { id: 'e1', name: 'Marie Dubois', role: 'Manager', color: '#3b82f6', hoursPerWeek: 39, leavesPerYear: 25, phone: '06 12 34 56 78', email: 'marie@station.fr', availableDays: [0,1,2,3,4] },
        { id: 'e2', name: 'Lucas Martin', role: 'Caissier', color: '#10b981', hoursPerWeek: 35, leavesPerYear: 25, phone: '06 23 45 67 89', email: 'lucas@station.fr', availableDays: [0,1,2,3,4,5,6] },
        { id: 'e3', name: 'Sophie Bernard', role: 'Pompiste', color: '#f59e0b', hoursPerWeek: 30, leavesPerYear: 25, phone: '06 34 56 78 90', email: 'sophie@station.fr', availableDays: [1,2,3,4,5,6] },
        { id: 'e4', name: 'Thomas Petit', role: 'Polyvalent', color: '#8b5cf6', hoursPerWeek: 35, leavesPerYear: 25, phone: '06 45 67 89 01', email: 'thomas@station.fr', availableDays: [0,2,3,4,5,6] }
    ],
    shifts: {}, // { 'employeeId_YYYY-MM-DD': { start, end, type, breakMin, note } }
    leaves: [
        // { id, employeeId, type, start, end, status, note }
    ],
    shiftTypes: [
        { id: 's1', name: 'Matin', start: '06:00', end: '14:00', color: '#3b82f6' },
        { id: 's2', name: 'Après-midi', start: '14:00', end: '22:00', color: '#f59e0b' },
        { id: 's3', name: 'Nuit', start: '22:00', end: '06:00', color: '#8b5cf6' },
        { id: 's4', name: 'Journée', start: '09:00', end: '17:00', color: '#10b981' }
    ],
    settings: {
        openTime: '06:00',
        closeTime: '22:00',
        is24h: false,
        minStaff: 1,
        stdHoursWeek: 35,
        minRest: 11
    },
    currentWeekStart: null // ISO date Monday
};

let state = loadState();

// ============== UTILS ==============
function uid() { return 'id_' + Math.random().toString(36).slice(2, 11); }

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return structuredClone(DEFAULT_STATE);
        const parsed = JSON.parse(raw);
        // Merge with default to avoid missing keys after updates
        return Object.assign(structuredClone(DEFAULT_STATE), parsed);
    } catch (e) {
        console.warn('Error loading state, using default', e);
        return structuredClone(DEFAULT_STATE);
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        toast('Erreur sauvegarde: ' + e.message, 'error');
    }
}

function getMonday(d = new Date()) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day; // ramener au lundi
    date.setDate(date.getDate() + diff);
    date.setHours(0,0,0,0);
    return date;
}

function formatDate(d) {
    const dd = new Date(d);
    return dd.toISOString().slice(0, 10);
}

function formatDateFR(d) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

function diffDays(d1, d2) {
    return Math.round((new Date(d2) - new Date(d1)) / 86400000);
}

function isSameDate(d1, d2) {
    return formatDate(d1) === formatDate(d2);
}

function timeToMinutes(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function shiftDuration(start, end, breakMin = 0) {
    let s = timeToMinutes(start);
    let e = timeToMinutes(end);
    if (e <= s) e += 24 * 60; // shift de nuit
    return Math.max(0, (e - s - breakMin) / 60);
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

function initials(name) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('');
}

function toast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('fade-out');
        setTimeout(() => el.remove(), 300);
    }, duration);
}

// ============== INIT ==============
function init() {
    if (!state.currentWeekStart) {
        state.currentWeekStart = formatDate(getMonday());
        saveState();
    }
    setupNavigation();
    setupPlanningEvents();
    setupEmployeeEvents();
    setupLeaveEvents();
    setupSettingsEvents();
    setupModalEvents();
    setupExportImport();
    renderAll();
}

function renderAll() {
    renderPlanning();
    renderEmployees();
    renderLeaves();
    renderStats();
    renderSettings();
}

// ============== NAVIGATION ==============
function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });
}

function switchView(view) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-' + view).classList.remove('hidden');
    if (view === 'stats') renderStats();
    if (view === 'leaves') renderLeaves();
}

// ============== PLANNING ==============
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
}

function navigateWeek(days) {
    const d = new Date(state.currentWeekStart);
    d.setDate(d.getDate() + days);
    state.currentWeekStart = formatDate(d);
    saveState();
    renderPlanning();
}

function getWeekDates() {
    const start = new Date(state.currentWeekStart);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function renderPlanning() {
    const grid = document.getElementById('planningGrid');
    const weekDates = getWeekDates();
    const today = formatDate(new Date());

    // Update week label
    const start = weekDates[0];
    const end = weekDates[6];
    document.getElementById('weekLabel').textContent =
        `${start.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} → ${end.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}`;

    let html = '<div class="grid-header">Employé</div>';
    const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

    weekDates.forEach((d, i) => {
        const isToday = formatDate(d) === today;
        const isWeekend = i >= 5;
        html += `<div class="grid-header day-header ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}">
            <div class="day-name">${dayNames[i]}</div>
            <div class="day-date">${d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</div>
        </div>`;
    });

    state.employees.forEach(emp => {
        const weekHours = computeWeekHours(emp.id, weekDates);
        const target = emp.hoursPerWeek;
        let hoursClass = 'hours-ok';
        if (weekHours > target * 1.05) hoursClass = 'hours-over';
        else if (weekHours < target * 0.95) hoursClass = 'hours-warn';

        html += `<div class="employee-cell">
            <div class="employee-avatar" style="background:${emp.color}">${initials(emp.name)}</div>
            <div>
                <div class="employee-name">${escapeHtml(emp.name)}</div>
                <div class="employee-meta"><span class="${hoursClass}">${weekHours.toFixed(1)}h / ${target}h</span></div>
                <div class="employee-meta">${escapeHtml(emp.role)}</div>
            </div>
        </div>`;

        weekDates.forEach((d, i) => {
            const dateStr = formatDate(d);
            const key = emp.id + '_' + dateStr;
            const shift = state.shifts[key];
            const onLeave = isOnLeave(emp.id, dateStr);
            const isToday = dateStr === today;
            const isWeekend = i >= 5;
            const isAvailable = !emp.availableDays || emp.availableDays.length === 0 || emp.availableDays.includes(i);

            let cellContent = '';
            let cellClass = 'shift-cell';
            if (isToday) cellClass += ' today';
            if (isWeekend) cellClass += ' weekend';

            if (onLeave) {
                cellContent = `<div class="shift-block leave">
                    <div class="shift-time">${onLeave.type === 'maladie' ? '🤒 Maladie' : onLeave.type === 'conges' ? '🏖️ Congé' : '📅 ' + onLeave.type}</div>
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
                    const shiftType = state.shiftTypes.find(t => t.id === shift.type);
                    const color = shiftType ? shiftType.color : emp.color;
                    cellContent = `<div class="shift-block" style="background:${color}">
                        <div class="shift-time">${shift.start} - ${shift.end}</div>
                        <div class="shift-name">${shiftType ? escapeHtml(shiftType.name) : 'Custom'}</div>
                        ${shift.note ? `<div class="shift-note">${escapeHtml(shift.note)}</div>` : ''}
                        <div class="shift-hours">${dur.toFixed(1)}h${shift.breakMin > 0 ? ' (-' + shift.breakMin + 'min)' : ''}</div>
                    </div>`;
                }
            } else {
                cellClass += ' empty';
                if (!isAvailable) {
                    cellContent = '<div style="opacity:0.3;text-align:center;padding-top:24px;font-size:11px">Indispo</div>';
                }
            }

            html += `<div class="${cellClass}" data-employee="${emp.id}" data-date="${dateStr}">${cellContent}</div>`;
        });
    });

    grid.innerHTML = html;

    // Cell click handlers
    grid.querySelectorAll('.shift-cell').forEach(cell => {
        cell.addEventListener('click', () => openShiftModal(cell.dataset.employee, cell.dataset.date));
    });
}

function computeWeekHours(empId, weekDates) {
    let total = 0;
    weekDates.forEach(d => {
        const key = empId + '_' + formatDate(d);
        const sh = state.shifts[key];
        if (sh && sh.start && sh.end && sh.type !== 'absence') {
            total += shiftDuration(sh.start, sh.end, sh.breakMin || 0);
        }
    });
    return total;
}

function isOnLeave(empId, dateStr) {
    return state.leaves.find(l =>
        l.employeeId === empId &&
        l.status === 'approuve' &&
        dateStr >= l.start && dateStr <= l.end
    );
}

function copyWeek() {
    if (!confirm('Copier le planning de cette semaine vers la semaine suivante ?')) return;
    const weekDates = getWeekDates();
    let count = 0;
    weekDates.forEach(d => {
        state.employees.forEach(emp => {
            const oldKey = emp.id + '_' + formatDate(d);
            const newDate = formatDate(addDays(d, 7));
            const newKey = emp.id + '_' + newDate;
            if (state.shifts[oldKey] && !state.shifts[newKey]) {
                state.shifts[newKey] = { ...state.shifts[oldKey] };
                count++;
            }
        });
    });
    saveState();
    navigateWeek(7);
    toast(`${count} shift(s) copié(s) vers la semaine suivante`, 'success');
}

function clearWeek() {
    if (!confirm('Supprimer tous les shifts de cette semaine ?')) return;
    const weekDates = getWeekDates();
    let count = 0;
    weekDates.forEach(d => {
        state.employees.forEach(emp => {
            const key = emp.id + '_' + formatDate(d);
            if (state.shifts[key]) {
                delete state.shifts[key];
                count++;
            }
        });
    });
    saveState();
    renderPlanning();
    toast(`${count} shift(s) supprimé(s)`, 'success');
}

function autoFillWeek() {
    if (!confirm("Remplir automatiquement la semaine en respectant les disponibilités, contrats et congés ?")) return;
    const weekDates = getWeekDates();
    const types = state.shiftTypes;
    if (types.length === 0) { toast('Aucun shift type configuré', 'warning'); return; }

    let assignments = 0;
    // Reset compteurs
    const empHours = {};
    state.employees.forEach(e => empHours[e.id] = computeWeekHours(e.id, weekDates));

    weekDates.forEach((d, i) => {
        const dateStr = formatDate(d);
        // Pour chaque type de shift à pourvoir ce jour
        types.forEach(type => {
            // Vérifier qu'il y a au moins minStaff personnes sur ce shift
            let assignedCount = 0;
            state.employees.forEach(e => {
                const sh = state.shifts[e.id + '_' + dateStr];
                if (sh && sh.type === type.id) assignedCount++;
            });
            const need = state.settings.minStaff - assignedCount;
            if (need <= 0) return;

            // Trouver candidats: dispo, pas en congé, pas déjà assigné ce jour, sous quota d'heures
            const candidates = state.employees
                .filter(e => {
                    if (!e.availableDays || e.availableDays.length === 0 || e.availableDays.includes(i)) {
                        if (isOnLeave(e.id, dateStr)) return false;
                        if (state.shifts[e.id + '_' + dateStr]) return false;
                        const dur = shiftDuration(type.start, type.end);
                        if (empHours[e.id] + dur > e.hoursPerWeek + 2) return false;
                        return true;
                    }
                    return false;
                })
                .sort((a, b) => (empHours[a.id] / a.hoursPerWeek) - (empHours[b.id] / b.hoursPerWeek));

            for (let n = 0; n < need && n < candidates.length; n++) {
                const e = candidates[n];
                state.shifts[e.id + '_' + dateStr] = {
                    type: type.id,
                    start: type.start,
                    end: type.end,
                    breakMin: 0,
                    note: ''
                };
                empHours[e.id] += shiftDuration(type.start, type.end);
                assignments++;
            }
        });
    });

    saveState();
    renderPlanning();
    toast(`Auto-remplissage terminé: ${assignments} shifts assignés`, 'success');
}

// ============== MODAL SHIFT ==============
let editingShiftKey = null;

function openShiftModal(empId, dateStr) {
    const emp = state.employees.find(e => e.id === empId);
    if (!emp) return;
    editingShiftKey = empId + '_' + dateStr;

    document.getElementById('shiftEmployeeInfo').innerHTML = `<span style="color:${emp.color}">●</span> ${escapeHtml(emp.name)} (${escapeHtml(emp.role)})`;
    document.getElementById('shiftDateInfo').textContent = new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Populate shift types select
    const sel = document.getElementById('shiftType');
    sel.innerHTML = '<option value="">-- Personnalisé --</option>' +
        state.shiftTypes.map(t => `<option value="${t.id}">${escapeHtml(t.name)} (${t.start} - ${t.end})</option>`).join('') +
        '<option value="absence">⚠️ Marquer comme absent</option>';

    const existing = state.shifts[editingShiftKey];
    if (existing) {
        sel.value = existing.type || '';
        document.getElementById('shiftStart').value = existing.start || '';
        document.getElementById('shiftEnd').value = existing.end || '';
        document.getElementById('shiftBreak').value = existing.breakMin || 0;
        document.getElementById('shiftNote').value = existing.note || '';
        document.getElementById('deleteShiftBtn').style.display = '';
        document.getElementById('shiftModalTitle').textContent = 'Modifier le shift';
    } else {
        sel.value = '';
        document.getElementById('shiftStart').value = '';
        document.getElementById('shiftEnd').value = '';
        document.getElementById('shiftBreak').value = 0;
        document.getElementById('shiftNote').value = '';
        document.getElementById('deleteShiftBtn').style.display = 'none';
        document.getElementById('shiftModalTitle').textContent = 'Affecter un shift';
    }

    // Vérifier conflits / alertes
    checkShiftAlerts(empId, dateStr);

    document.getElementById('shiftModal').classList.remove('hidden');
}

function checkShiftAlerts(empId, dateStr) {
    const alertEl = document.getElementById('shiftAlert');
    const emp = state.employees.find(e => e.id === empId);
    const messages = [];

    // En congé ?
    const leave = isOnLeave(empId, dateStr);
    if (leave) {
        messages.push(`⚠️ Cet employé est en ${leave.type} du ${leave.start} au ${leave.end}`);
    }

    // Disponibilité jour
    const dayIdx = (new Date(dateStr).getDay() + 6) % 7; // 0=Lun
    if (emp.availableDays && emp.availableDays.length > 0 && !emp.availableDays.includes(dayIdx)) {
        messages.push(`⚠️ Cet employé n'est pas disponible ce jour selon son contrat`);
    }

    if (messages.length > 0) {
        alertEl.innerHTML = messages.join('<br>');
        alertEl.className = 'alert warning';
    } else {
        alertEl.classList.add('hidden');
    }
}

function setupModalEvents() {
    // Close handlers
    document.querySelectorAll('[data-close-modal]').forEach(b => {
        b.addEventListener('click', () => closeModal(b.dataset.closeModal));
    });
    document.querySelectorAll('.modal-overlay').forEach(o => {
        o.addEventListener('click', e => {
            if (e.target === o) closeModal(o.id);
        });
    });

    // Shift type change auto-fills times
    document.getElementById('shiftType').addEventListener('change', e => {
        const t = state.shiftTypes.find(x => x.id === e.target.value);
        if (t) {
            document.getElementById('shiftStart').value = t.start;
            document.getElementById('shiftEnd').value = t.end;
        }
    });

    document.getElementById('saveShiftBtn').addEventListener('click', saveShift);
    document.getElementById('deleteShiftBtn').addEventListener('click', deleteShift);
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function saveShift() {
    if (!editingShiftKey) return;
    const type = document.getElementById('shiftType').value;
    const start = document.getElementById('shiftStart').value;
    const end = document.getElementById('shiftEnd').value;
    const breakMin = parseInt(document.getElementById('shiftBreak').value || 0);
    const note = document.getElementById('shiftNote').value.trim();

    if (type === 'absence') {
        state.shifts[editingShiftKey] = { type: 'absence', note };
    } else {
        if (!start || !end) {
            toast('Heures de début et fin requises', 'error');
            return;
        }
        state.shifts[editingShiftKey] = { type: type || 'custom', start, end, breakMin, note };
    }
    saveState();
    closeModal('shiftModal');
    renderPlanning();
    toast('Shift enregistré', 'success');
}

function deleteShift() {
    if (!editingShiftKey) return;
    delete state.shifts[editingShiftKey];
    saveState();
    closeModal('shiftModal');
    renderPlanning();
    toast('Shift supprimé', 'success');
}

// ============== EMPLOYÉS ==============
let editingEmployeeId = null;

function setupEmployeeEvents() {
    document.getElementById('addEmployeeBtn').addEventListener('click', () => openEmployeeModal());
    document.getElementById('saveEmployeeBtn').addEventListener('click', saveEmployee);
    document.getElementById('deleteEmployeeBtn').addEventListener('click', deleteEmployee);
}

function renderEmployees() {
    const grid = document.getElementById('employeesGrid');
    if (state.employees.length === 0) {
        grid.innerHTML = '<div class="leaves-list-empty">Aucun employé. Cliquez sur "Ajouter un employé".</div>';
        return;
    }

    grid.innerHTML = state.employees.map(emp => {
        const leavesUsed = computeLeavesUsed(emp.id);
        const leavesRemaining = emp.leavesPerYear - leavesUsed;
        const remainClass = leavesRemaining < 5 ? 'warning' : leavesRemaining < 0 ? 'danger' : 'success';

        // Heures depuis 30 derniers jours
        const last30 = computeLastDaysHours(emp.id, 30);

        const dayLabels = ['L','M','M','J','V','S','D'];
        const days = (emp.availableDays || []).map(i => dayLabels[i]).join(' ');

        return `<div class="employee-card" data-employee="${emp.id}" style="--card-color:${emp.color}">
            <div class="employee-card-header">
                <div class="employee-avatar" style="background:${emp.color}">${initials(emp.name)}</div>
                <div>
                    <div class="employee-card-name">${escapeHtml(emp.name)}</div>
                    <div class="employee-card-role">${escapeHtml(emp.role)}</div>
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
                ${emp.phone ? `📞 ${escapeHtml(emp.phone)}` : ''}
                ${emp.email ? `<br>✉️ ${escapeHtml(emp.email)}` : ''}
                ${days ? `<br>📅 Dispo: ${days}` : ''}
            </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.employee-card').forEach(card => {
        card.addEventListener('click', () => openEmployeeModal(card.dataset.employee));
    });
    
    // Update employee select for leaves
    const sel = document.getElementById('leaveEmployee');
    if (sel) sel.innerHTML = state.employees.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
}

function computeLeavesUsed(empId) {
    let total = 0;
    state.leaves.forEach(l => {
        if (l.employeeId === empId && l.status === 'approuve' && (l.type === 'conges' || l.type === 'rtt')) {
            total += diffDays(l.start, l.end) + 1;
        }
    });
    return total;
}

function computeLastDaysHours(empId, days) {
    const today = new Date();
    let total = 0;
    for (let i = 0; i < days; i++) {
        const d = addDays(today, -i);
        const sh = state.shifts[empId + '_' + formatDate(d)];
        if (sh && sh.start && sh.end && sh.type !== 'absence') {
            total += shiftDuration(sh.start, sh.end, sh.breakMin || 0);
        }
    }
    return total;
}

function openEmployeeModal(id = null) {
    editingEmployeeId = id;
    const isEdit = !!id;
    document.getElementById('employeeModalTitle').textContent = isEdit ? "Modifier l'employé" : 'Nouvel employé';
    document.getElementById('deleteEmployeeBtn').classList.toggle('hidden', !isEdit);

    if (isEdit) {
        const e = state.employees.find(emp => emp.id === id);
        document.getElementById('empName').value = e.name || '';
        document.getElementById('empRole').value = e.role || 'Caissier';
        document.getElementById('empColor').value = e.color || '#3b82f6';
        document.getElementById('empHours').value = e.hoursPerWeek || 35;
        document.getElementById('empLeaves').value = e.leavesPerYear || 25;
        document.getElementById('empPhone').value = e.phone || '';
        document.getElementById('empEmail').value = e.email || '';
        document.querySelectorAll('#empDays input').forEach(cb => {
            cb.checked = (e.availableDays || []).includes(parseInt(cb.value));
        });
    } else {
        document.getElementById('empName').value = '';
        document.getElementById('empRole').value = 'Caissier';
        document.getElementById('empColor').value = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
        document.getElementById('empHours').value = 35;
        document.getElementById('empLeaves').value = 25;
        document.getElementById('empPhone').value = '';
        document.getElementById('empEmail').value = '';
        document.querySelectorAll('#empDays input').forEach(cb => cb.checked = true);
    }
    document.getElementById('employeeModal').classList.remove('hidden');
}

function saveEmployee() {
    const name = document.getElementById('empName').value.trim();
    if (!name) { toast('Le nom est requis', 'error'); return; }

    const data = {
        name,
        role: document.getElementById('empRole').value,
        color: document.getElementById('empColor').value,
        hoursPerWeek: parseInt(document.getElementById('empHours').value) || 35,
        leavesPerYear: parseInt(document.getElementById('empLeaves').value) || 25,
        phone: document.getElementById('empPhone').value.trim(),
        email: document.getElementById('empEmail').value.trim(),
        availableDays: Array.from(document.querySelectorAll('#empDays input:checked')).map(cb => parseInt(cb.value))
    };

    if (editingEmployeeId) {
        const idx = state.employees.findIndex(e => e.id === editingEmployeeId);
        state.employees[idx] = { ...state.employees[idx], ...data };
        toast('Employé modifié', 'success');
    } else {
        state.employees.push({ id: uid(), ...data });
        toast('Employé ajouté', 'success');
    }

    saveState();
    closeModal('employeeModal');
    renderEmployees();
    renderPlanning();
}

function deleteEmployee() {
    if (!editingEmployeeId) return;
    if (!confirm('Supprimer cet employé ? Tous ses shifts et congés seront supprimés.')) return;

    state.employees = state.employees.filter(e => e.id !== editingEmployeeId);
    Object.keys(state.shifts).forEach(k => {
        if (k.startsWith(editingEmployeeId + '_')) delete state.shifts[k];
    });
    state.leaves = state.leaves.filter(l => l.employeeId !== editingEmployeeId);

    saveState();
    closeModal('employeeModal');
    renderEmployees();
    renderPlanning();
    toast('Employé supprimé', 'success');
}

// ============== CONGÉS ==============
let editingLeaveId = null;

function setupLeaveEvents() {
    document.getElementById('addLeaveBtn').addEventListener('click', () => openLeaveModal());
    document.getElementById('saveLeaveBtn').addEventListener('click', saveLeave);
    document.getElementById('deleteLeaveBtn').addEventListener('click', deleteLeave);
}

function renderLeaves() {
    // Summary
    const summary = document.getElementById('leavesSummary');
    const enAttente = state.leaves.filter(l => l.status === 'en_attente').length;
    const approuves = state.leaves.filter(l => l.status === 'approuve').length;
    const refuses = state.leaves.filter(l => l.status === 'refuse').length;

    // Total congés restants tous employés confondus
    let totalRestants = 0, totalPris = 0;
    state.employees.forEach(e => {
        const used = computeLeavesUsed(e.id);
        totalPris += used;
        totalRestants += (e.leavesPerYear - used);
    });

    summary.innerHTML = `
        <div class="summary-card warning">
            <div class="summary-label">En attente</div>
            <div class="summary-value">${enAttente}</div>
        </div>
        <div class="summary-card success">
            <div class="summary-label">Approuvés</div>
            <div class="summary-value">${approuves}</div>
        </div>
        <div class="summary-card danger">
            <div class="summary-label">Refusés</div>
            <div class="summary-value">${refuses}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Jours pris</div>
            <div class="summary-value">${totalPris}j</div>
        </div>
        <div class="summary-card success">
            <div class="summary-label">Jours restants</div>
            <div class="summary-value">${totalRestants}j</div>
        </div>
    `;

    // List
    const list = document.getElementById('leavesList');
    if (state.leaves.length === 0) {
        list.innerHTML = '<div class="leaves-list-empty">Aucune demande de congé. Cliquez sur "Nouvelle demande".</div>';
        return;
    }

    const sorted = [...state.leaves].sort((a, b) => (b.start || '').localeCompare(a.start || ''));

    list.innerHTML = sorted.map(l => {
        const emp = state.employees.find(e => e.id === l.employeeId);
        if (!emp) return '';
        const dur = diffDays(l.start, l.end) + 1;
        return `<div class="leave-item" data-leave="${l.id}">
            <div class="leave-employee">
                <span style="color:${emp.color}">●</span> ${escapeHtml(emp.name)}
            </div>
            <div class="leave-type">${escapeHtml(l.type)}</div>
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
    const isEdit = !!id;
    document.getElementById('leaveModalTitle').textContent = isEdit ? 'Modifier la demande' : 'Nouvelle demande de congé';
    document.getElementById('deleteLeaveBtn').classList.toggle('hidden', !isEdit);

    const sel = document.getElementById('leaveEmployee');
    sel.innerHTML = state.employees.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');

    if (isEdit) {
        const l = state.leaves.find(x => x.id === id);
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
    const employeeId = document.getElementById('leaveEmployee').value;
    const type = document.getElementById('leaveType').value;
    const start = document.getElementById('leaveStart').value;
    const end = document.getElementById('leaveEnd').value;
    const status = document.getElementById('leaveStatus').value;
    const note = document.getElementById('leaveNote').value.trim();

    if (!employeeId || !start || !end) {
        toast('Tous les champs sont requis', 'error');
        return;
    }
    if (end < start) {
        toast('La date de fin doit être après le début', 'error');
        return;
    }

    if (editingLeaveId) {
        const idx = state.leaves.findIndex(l => l.id === editingLeaveId);
        state.leaves[idx] = { ...state.leaves[idx], employeeId, type, start, end, status, note };
        toast('Demande modifiée', 'success');
    } else {
        state.leaves.push({ id: uid(), employeeId, type, start, end, status, note });
        toast('Demande créée', 'success');
    }

    saveState();
    closeModal('leaveModal');
    renderLeaves();
    renderPlanning();
    renderEmployees();
}

function deleteLeave() {
    if (!editingLeaveId) return;
    if (!confirm('Supprimer cette demande de congé ?')) return;
    state.leaves = state.leaves.filter(l => l.id !== editingLeaveId);
    saveState();
    closeModal('leaveModal');
    renderLeaves();
    renderPlanning();
    renderEmployees();
    toast('Demande supprimée', 'success');
}

// ============== STATISTIQUES ==============
function renderStats() {
    const container = document.getElementById('statsContainer');
    const weekDates = getWeekDates();

    // Heures par employé cette semaine
    const empHoursRows = state.employees.map(e => {
        const h = computeWeekHours(e.id, weekDates);
        const pct = (h / e.hoursPerWeek) * 100;
        const over = h > e.hoursPerWeek;
        return { name: e.name, hours: h, target: e.hoursPerWeek, pct: Math.min(pct, 150), over };
    });

    // Heures totales par jour
    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const dayHours = weekDates.map((d, i) => {
        let total = 0;
        const dateStr = formatDate(d);
        state.employees.forEach(e => {
            const sh = state.shifts[e.id + '_' + dateStr];
            if (sh && sh.start && sh.end && sh.type !== 'absence') {
                total += shiftDuration(sh.start, sh.end, sh.breakMin || 0);
            }
        });
        return { name: dayNames[i], hours: total };
    });
    const maxDayHours = Math.max(1, ...dayHours.map(d => d.hours));

    // Effectif par jour
    const dayStaff = weekDates.map((d, i) => {
        let count = 0;
        const dateStr = formatDate(d);
        state.employees.forEach(e => {
            const sh = state.shifts[e.id + '_' + dateStr];
            if (sh && sh.type !== 'absence' && !isOnLeave(e.id, dateStr)) count++;
        });
        return { name: dayNames[i], count };
    });
    const maxStaff = Math.max(1, ...dayStaff.map(d => d.count));

    // Total semaine
    const totalWeek = empHoursRows.reduce((s, r) => s + r.hours, 0);
    const totalCost = totalWeek * 12; // approximation: 12€/h

    container.innerHTML = `
        <div class="stats-grid">
            <div class="chart-card">
                <h3>Total heures</h3>
                <div class="summary-value">${totalWeek.toFixed(1)}h</div>
            </div>
            <div class="chart-card">
                <h3>Coût estimatif (12€/h)</h3>
                <div class="summary-value">${totalCost.toFixed(0)}€</div>
            </div>
            <div class="chart-card">
                <h3>Employés actifs</h3>
                <div class="summary-value">${state.employees.length}</div>
            </div>
            <div class="chart-card">
                <h3>Shifts planifiés</h3>
                <div class="summary-value">${Object.keys(state.shifts).length}</div>
            </div>
        </div>

        <div class="chart-card">
            <h3>Heures par employé (semaine)</h3>
            ${empHoursRows.map(r => `
                <div class="bar-row">
                    <div class="bar-name">${escapeHtml(r.name)}</div>
                    <div class="bar-track"><div class="bar-fill ${r.over ? 'over' : ''}" style="width:${Math.min(r.pct, 100)}%"></div></div>
                    <div class="bar-value">${r.hours.toFixed(1)}h / ${r.target}h</div>
                </div>
            `).join('')}
        </div>

        <div class="chart-card">
            <h3>Charge par jour (heures)</h3>
            ${dayHours.map(d => `
                <div class="bar-row">
                    <div class="bar-name">${d.name}</div>
                    <div class="bar-track"><div class="bar-fill" style="width:${(d.hours / maxDayHours) * 100}%"></div></div>
                    <div class="bar-value">${d.hours.toFixed(1)}h</div>
                </div>
            `).join('')}
        </div>

        <div class="chart-card">
            <h3>Effectif par jour</h3>
            ${dayStaff.map(d => `
                <div class="bar-row">
                    <div class="bar-name">${d.name}</div>
                    <div class="bar-track"><div class="bar-fill" style="width:${(d.count / maxStaff) * 100}%"></div></div>
                    <div class="bar-value">${d.count} pers.</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============== PARAMÈTRES ==============
function setupSettingsEvents() {
    ['settingOpen','settingClose','setting24h','settingMinStaff','settingStdHours','settingRest'].forEach(id => {
        document.getElementById(id).addEventListener('change', e => {
            const key = id.replace('setting', '');
            const map = { Open: 'openTime', Close: 'closeTime', '24h': 'is24h', MinStaff: 'minStaff', StdHours: 'stdHoursWeek', Rest: 'minRest' };
            const k = map[key];
            const val = e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'number' ? parseInt(e.target.value) : e.target.value);
            state.settings[k] = val;
            saveState();
            toast('Paramètre enregistré', 'success', 1500);
        });
    });

    document.getElementById('addShiftBtn').addEventListener('click', () => openShiftSettingModal());
    document.getElementById('saveShiftSettingBtn').addEventListener('click', saveShiftSetting);
    document.getElementById('deleteShiftSettingBtn').addEventListener('click', deleteShiftSetting);

    document.getElementById('resetDataBtn').addEventListener('click', () => {
        if (!confirm('⚠️ ATTENTION : cette action supprime TOUTES les données (employés, shifts, congés). Cette action est irréversible. Continuer ?')) return;
        if (!confirm('Confirmer la suppression définitive de toutes les données ?')) return;
        localStorage.removeItem(STORAGE_KEY);
        state = structuredClone(DEFAULT_STATE);
        state.currentWeekStart = formatDate(getMonday());
        saveState();
        renderAll();
        toast('Données réinitialisées', 'success');
    });
}

function renderSettings() {
    document.getElementById('settingOpen').value = state.settings.openTime;
    document.getElementById('settingClose').value = state.settings.closeTime;
    document.getElementById('setting24h').checked = !!state.settings.is24h;
    document.getElementById('settingMinStaff').value = state.settings.minStaff;
    document.getElementById('settingStdHours').value = state.settings.stdHoursWeek;
    document.getElementById('settingRest').value = state.settings.minRest;

    const list = document.getElementById('shiftsList');
    list.innerHTML = state.shiftTypes.map(t => `
        <div class="shift-setting-item">
            <div class="shift-color-dot" style="background:${t.color}"></div>
            <div class="shift-setting-info">
                <div class="shift-setting-name">${escapeHtml(t.name)}</div>
                <div class="shift-setting-time">${t.start} → ${t.end} (${shiftDuration(t.start, t.end).toFixed(1)}h)</div>
            </div>
            <div class="shift-setting-actions">
                <button data-edit-shift="${t.id}">Modifier</button>
            </div>
        </div>
    `).join('');

    list.querySelectorAll('[data-edit-shift]').forEach(btn => {
        btn.addEventListener('click', () => openShiftSettingModal(btn.dataset.editShift));
    });
}

let editingShiftSettingId = null;
function openShiftSettingModal(id = null) {
    editingShiftSettingId = id;
    const isEdit = !!id;
    document.getElementById('deleteShiftSettingBtn').classList.toggle('hidden', !isEdit);

    if (isEdit) {
        const t = state.shiftTypes.find(x => x.id === id);
        document.getElementById('shiftSetName').value = t.name;
        document.getElementById('shiftSetStart').value = t.start;
        document.getElementById('shiftSetEnd').value = t.end;
        document.getElementById('shiftSetColor').value = t.color;
    } else {
        document.getElementById('shiftSetName').value = '';
        document.getElementById('shiftSetStart').value = '08:00';
        document.getElementById('shiftSetEnd').value = '16:00';
        document.getElementById('shiftSetColor').value = '#3b82f6';
    }
    document.getElementById('shiftSettingModal').classList.remove('hidden');
}

function saveShiftSetting() {
    const name = document.getElementById('shiftSetName').value.trim();
    const start = document.getElementById('shiftSetStart').value;
    const end = document.getElementById('shiftSetEnd').value;
    const color = document.getElementById('shiftSetColor').value;
    if (!name || !start || !end) { toast('Champs requis', 'error'); return; }

    if (editingShiftSettingId) {
        const idx = state.shiftTypes.findIndex(x => x.id === editingShiftSettingId);
        state.shiftTypes[idx] = { ...state.shiftTypes[idx], name, start, end, color };
    } else {
        state.shiftTypes.push({ id: uid(), name, start, end, color });
    }
    saveState();
    closeModal('shiftSettingModal');
    renderSettings();
    toast('Shift enregistré', 'success');
}

function deleteShiftSetting() {
    if (!editingShiftSettingId) return;
    if (!confirm('Supprimer ce type de shift ?')) return;
    state.shiftTypes = state.shiftTypes.filter(x => x.id !== editingShiftSettingId);
    saveState();
    closeModal('shiftSettingModal');
    renderSettings();
    toast('Shift supprimé', 'success');
}

// ============== EXPORT / IMPORT ==============
function setupExportImport() {
    document.getElementById('exportBtn').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `planning-station-${formatDate(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast('Export téléchargé', 'success');
    });

    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const imported = JSON.parse(reader.result);
                if (!confirm('Remplacer toutes les données actuelles par celles du fichier ?')) return;
                state = Object.assign(structuredClone(DEFAULT_STATE), imported);
                saveState();
                renderAll();
                toast('Import réussi', 'success');
            } catch (err) {
                toast('Fichier invalide: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });
}

// ============== START ==============
document.addEventListener('DOMContentLoaded', init);
