import { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ArrowLeft, Users, Receipt, TrendingUp, TrendingDown,
  CheckCircle2, Clock, Send, X, UserPlus, Trash2, Bell, Crown,
  ScanLine, Tag, User, ChevronRight, LogOut } from 'lucide-react';
import {
  Plus,
  ArrowLeft,
  Users,
  Receipt,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Send,
  X,
  UserPlus,
  Trash2,
} from 'lucide-react';

export type Screen =
  | 'home' | 'group' | 'add-expense' | 'ocr-scan'
  | 'settlement' | 'payment' | 'create-group'
  | 'reminders' | 'profile' | 'subscription' | 'discounts' | 'login';
export type Plan = 'free' | 'premium';

export type AppUser = {
  name: string;
  phone: string;
  plan: Plan;
};
export type Group = {
  id: string;
  name: string;
  participants: string[];
  settledExpenseIds: string[];
  expenses: Expense[];
};

export type Expense = {
  id: string;
  name: string;
  amount: number;
  paidBy: string;
  participants: string[];
  date: string;
};

export type Balance = {
  from: string;
  to: string;
  amount: number;
};

export type Reminder = {
  id: string;
  groupId: string;
  groupName: string;
  targetUser: string;
  amount: number;
  sentAt: string;
  status: 'sent' | 'paid';
};

type AppCtx = {
  user: AppUser | null;
  groups: Group[];
  reminders: Reminder[];
  setUser: (u: AppUser | null) => void;
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  setReminders: React.Dispatch<React.SetStateAction<Reminder[]>>;
};

export const AppContext = createContext<AppCtx>({} as AppCtx);
export const useApp = () => useContext(AppContext);

export function computeTotalExpense(g: Group) {
  return g.expenses.reduce((s, e) => s + e.amount, 0);
}

export function getUserBalance(group: Group, user = 'Tú'): number {
  const bal: Record<string, number> = {};
  group.participants.forEach(p => (bal[p] = 0));
  group.expenses.forEach(e => {
    const share = e.amount / e.participants.length;
    e.participants.forEach(p => { bal[p] -= share; });
    bal[e.paidBy] += e.amount;
  });
  return bal[user] || 0;
}

export function calculateBalances(group: Group): Balance[] {
  const bal: Record<string, number> = {};
  group.participants.forEach(p => (bal[p] = 0));
  group.expenses.forEach(e => {
    const share = e.amount / e.participants.length;
    e.participants.forEach(p => { bal[p] -= share; });
    bal[e.paidBy] += e.amount;
  });
  const debts: Balance[] = [];
  const creditors = Object.entries(bal).filter(([, v]) => v > 0.01);
  const debtors   = Object.entries(bal).filter(([, v]) => v < -0.01);
  debtors.forEach(([debtor, debt]) => {
    let rem = Math.abs(debt);
    creditors.forEach(([creditor, credit]) => {
      if (rem > 0.01 && credit > 0.01) {
        const t = Math.min(rem, credit);
        debts.push({ from: debtor, to: creditor, amount: t });
        rem -= t; bal[creditor] -= t;
      }
    });
  });
  return debts;
}

export function computeUserStatus(g: Group, user = 'Tú') {
  const b = getUserBalance(g, user);
  if (b < -0.01) return { type: 'owes' as const, amount: Math.abs(b) };
  if (b >  0.01) return { type: 'owed' as const, amount: b };
  return { type: 'settled' as const, amount: 0 };
}

const STORAGE_KEY = 'splitpay_groups';
const KEY_GROUPS    = 'splitpay_groups';
const KEY_USER      = 'splitpay_user';
const KEY_REMINDERS = 'splitpay_reminders';

const defaultGroups: Group[] = [
  {
    id: '1', name: 'Viaje a Cusco',
    participants: ['Tú', 'Ana', 'Carlos', 'María'],
    settledExpenseIds: [],
    expenses: [
      { id:'e1', name:'Hotel',          amount:480,   paidBy:'Ana',    participants:['Tú','Ana','Carlos','María'], date:'2026-04-08' },
      { id:'e2', name:'Cena en Cusco',  amount:156.5, paidBy:'Carlos', participants:['Tú','Ana','Carlos','María'], date:'2026-04-08' },
      { id:'e3', name:'Tour Machu Picchu',amount:320, paidBy:'Tú',     participants:['Tú','Ana','Carlos'],        date:'2026-04-09' },
      { id:'e4', name:'Transporte',     amount:84,    paidBy:'María',  participants:['Tú','Ana','Carlos','María'], date:'2026-04-09' },
      { id:'e5', name:'Almuerzo mercado',amount:200,  paidBy:'Ana',    participants:['Tú','Ana','Carlos','María'], date:'2026-04-10' },
    ],
  },
  {
    id: '2', name: 'Cena oficina',
    participants: ['Tú', 'Juan', 'Luis'],
    settledExpenseIds: [],
    expenses: [
      { id:'e6', name:'Pizza',   amount:120, paidBy:'Tú', participants:['Tú','Juan','Luis'], date:'2026-04-09' },
      { id:'e7', name:'Bebidas', amount:60,  paidBy:'Tú', participants:['Tú','Juan','Luis'], date:'2026-04-09' },
    ],
  },
  {
    id: '3', name: 'Casa de playa',
    participants: ['Tú', 'Sofia', 'Diego'],
    settledExpenseIds: ['e8','e9'],
    expenses: [
      { id:'e8', name:'Alquiler casa', amount:600, paidBy:'Sofia', participants:['Tú','Sofia','Diego'], date:'2026-04-01' },
      { id:'e9', name:'Comida',        amount:150, paidBy:'Diego', participants:['Tú','Sofia','Diego'], date:'2026-04-02' },
    ],
  },
];

function loadGroups(): Group[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Group[];
  } catch { /* ignore */ }
  return defaultGroups;
}
function load<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}

function saveGroups(groups: Group[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

export default function App() {
  const [user,      setUserState] = useState<AppUser | null>(() => load(KEY_USER, null));
  const [groups,    setGroups]    = useState<Group[]>(() => load(KEY_GROUPS, defaultGroups));
  const [reminders, setReminders] = useState<Reminder[]>(() => load(KEY_REMINDERS, []));

  const [screen,          setScreen]          = useState<Screen>(user ? 'home' : 'login');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showExpenseDetail, setShowExpenseDetail] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem(KEY_GROUPS,    JSON.stringify(groups));    }, [groups]);
  useEffect(() => { localStorage.setItem(KEY_USER,      JSON.stringify(user));      }, [user]);
  useEffect(() => { localStorage.setItem(KEY_REMINDERS, JSON.stringify(reminders)); }, [reminders]);

  const setUser = (u: AppUser | null) => {
    setUserState(u);
    setScreen(u ? 'home' : 'login');
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId) ?? null;

  const totalOwed = groups.reduce((s, g) => {
    const st = computeUserStatus(g); return st.type === 'owes' ? s + st.amount : s;
  }, 0);
  const totalOwedToYou = groups.reduce((s, g) => {
    const st = computeUserStatus(g); return st.type === 'owed' ? s + st.amount : s;
  }, 0);

  const goToGroup = (g: Group) => { setSelectedGroupId(g.id); setShowExpenseDetail(null); setScreen('group'); };

  const goBack = () => {
    const map: Partial<Record<Screen, Screen>> = {
      group: 'home', 'create-group': 'home', 'add-expense': 'group',
      'ocr-scan': 'add-expense', settlement: 'group', payment: 'settlement',
      reminders: 'group', profile: 'home', subscription: 'profile', discounts: 'home',
    };
    setScreen(map[screen] ?? 'home');
  };

const createGroup = (name: string, participants: string[]) => {
    const g: Group = { id: Date.now().toString(), name, participants: ['Tú', ...participants], settledExpenseIds: [], expenses: [] };
    setGroups(p => [g, ...p]);
    setSelectedGroupId(g.id);
    setScreen('group');
  };

  const addExpense = (groupId: string, expense: Omit<Expense, 'id' | 'date'>) => {
    setGroups(p => p.map(g => g.id !== groupId ? g : {
      ...g, expenses: [...g.expenses, { ...expense, id: `e-${Date.now()}`, date: new Date().toISOString().slice(0,10) }],
    }));
    setScreen('group');
  };

  const deleteExpense = (groupId: string, expenseId: string) =>
    setGroups(p => p.map(g => g.id !== groupId ? g : {
      ...g,
      expenses: g.expenses.filter(e => e.id !== expenseId),
      settledExpenseIds: g.settledExpenseIds.filter(id => id !== expenseId),
    }));

  const deleteGroup = (groupId: string) => {
    setGroups(p => p.filter(g => g.id !== groupId));
    setScreen('home'); setSelectedGroupId(null);
  };

  const settleAll = (groupId: string) => {
    setGroups(p => p.map(g => g.id !== groupId ? g : { ...g, settledExpenseIds: g.expenses.map(e => e.id) }));
    setScreen('group');
  };

  const sendReminder = (groupId: string, targetUser: string, amount: number) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const r: Reminder = {
      id: Date.now().toString(), groupId, groupName: group.name,
      targetUser, amount, sentAt: new Date().toISOString(), status: 'sent',
    };
    setReminders(p => [r, ...p]);
  };

  const markReminderPaid = (reminderId: string) =>
    setReminders(p => p.map(r => r.id === reminderId ? { ...r, status: 'paid' } : r));

  const ctx: AppCtx = { user, groups, reminders, setUser, setGroups, setReminders };

  const pendingReminders = reminders.filter(r => r.status === 'sent').length;

  return (
     <AppContext.Provider value={ctx}>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md min-h-[812px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">

            {screen === 'login' && (
              <LoginScreen key="login" />
            )}

            {screen === 'home' && (
              <HomeScreen key="home"
                groups={groups} totalOwed={totalOwed} totalOwedToYou={totalOwedToYou}
                pendingReminders={pendingReminders}
                onGroupClick={goToGroup}
                onAddGroup={() => setScreen('create-group')}
                onProfile={() => setScreen('profile')}
                onDiscounts={() => setScreen('discounts')}
              />
            )}

            {screen === 'create-group' && (
              <CreateGroupScreen key="create-group" onBack={goBack} onCreate={createGroup} />
            )}

            {screen === 'group' && selectedGroup && (
              <GroupScreen key="group" group={selectedGroup} onBack={goBack}
                onAddExpense={() => setScreen('add-expense')}
                onSettle={() => setScreen('settlement')}
                onReminders={() => setScreen('reminders')}
                onDeleteExpense={(id) => deleteExpense(selectedGroup.id, id)}
                onDeleteGroup={() => deleteGroup(selectedGroup.id)}
                showExpenseDetail={showExpenseDetail}
                setShowExpenseDetail={setShowExpenseDetail}
              />
            )}

            {screen === 'add-expense' && selectedGroup && (
              <AddExpenseScreen key="add-expense" group={selectedGroup} onBack={goBack}
                onSave={(e) => addExpense(selectedGroup.id, e)}
                onScan={() => setScreen('ocr-scan')}
              />
            )}

            {screen === 'ocr-scan' && selectedGroup && (
              <OCRScanScreen key="ocr-scan" group={selectedGroup} onBack={goBack}
                onConfirm={(e) => addExpense(selectedGroup.id, e)}
              />
            )}

            {screen === 'settlement' && selectedGroup && (
              <SettlementScreen key="settlement" group={selectedGroup} onBack={goBack}
                onPay={() => setScreen('payment')}
                onSettleAll={() => settleAll(selectedGroup.id)}
                onSendReminder={(target, amount) => sendReminder(selectedGroup.id, target, amount)}
              />
            )}

            {screen === 'payment' && selectedGroup && (
              <PaymentScreen key="payment" group={selectedGroup} onBack={goBack}
                onComplete={() => settleAll(selectedGroup.id)}
              />
            )}

            {screen === 'reminders' && selectedGroup && (
              <RemindersScreen key="reminders" group={selectedGroup} onBack={goBack}
                reminders={reminders.filter(r => r.groupId === selectedGroup.id)}
                onSendReminder={(target, amount) => sendReminder(selectedGroup.id, target, amount)}
                onMarkPaid={markReminderPaid}
              />
            )}

            {screen === 'profile' && (
              <ProfileScreen key="profile" onBack={goBack}
                onUpgrade={() => setScreen('subscription')}
              />
            )}

            {screen === 'subscription' && (
              <SubscriptionScreen key="subscription" onBack={goBack} />
            )}

            {screen === 'discounts' && (
              <DiscountsScreen key="discounts" onBack={goBack}
                onUpgrade={() => setScreen('subscription')}
              />
            )}

          </AnimatePresence>
        </div>
      </div>
    </AppContext.Provider>
  );
}

function PageHeader({ title, subtitle, onBack, right }: {
  title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode;
}) {
  return (
    <div className="bg-primary text-primary-foreground p-6">
      {onBack && (
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="p-2 -ml-2 hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-6 h-6" />
          </button>
          {right}
        </div>
      )}
      {!onBack && right && <div className="flex justify-end mb-4">{right}</div>}
      <h2>{title}</h2>
      {subtitle && <p className="text-sm opacity-80 mt-1">{subtitle}</p>}
    </div>
  );
}

function Slide({ children, dir = 'up' }: { children: React.ReactNode; dir?: 'up' | 'right' | 'left' }) {
  const x = dir === 'right' ? 40 : dir === 'left' ? -40 : 0;
  const y = dir === 'up' ? 20 : 0;
  return (
    <motion.div initial={{ opacity:0, x, y }} animate={{ opacity:1, x:0, y:0 }}
      exit={{ opacity:0, x: -x, y: -y }} className="flex-1 flex flex-col">
      {children}
    </motion.div>
  );
}

// ─── LoginScreen ──────────────────────────────────────────────────────────────

function LoginScreen() {
  const { setUser } = useApp();
  const [phone, setPhone] = useState('');
  const [name,  setName]  = useState('');
  const [step,  setStep]  = useState<'phone' | 'name'>('phone');
  const [loading, setLoading] = useState(false);

  const handlePhone = () => {
    if (phone.length < 9) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setStep('name'); }, 1200);
  };

  const handleLogin = () => {
    if (!name.trim()) return;
    setUser({ name: name.trim(), phone, plan: 'free' });
  };

  return (
    <Slide dir="up">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-6">
          <Receipt className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">SplitPay</h1>
        <p className="text-muted-foreground text-sm text-center mb-10">
          Divide gastos sin incomodidad
        </p>

        <AnimatePresence mode="wait">
          {step === 'phone' && (
            <motion.div key="phone" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} className="w-full space-y-4">
              <label className="block text-sm font-medium">Número de celular</label>
              <div className="flex gap-2">
                <span className="h-14 px-4 bg-muted rounded-xl flex items-center text-sm font-medium">+51</span>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/,'').slice(0,9))}
                  placeholder="9XX XXX XXX" autoFocus maxLength={9}
                  className="flex-1 h-14 px-4 bg-input-background rounded-xl border-2 border-transparent focus:border-primary outline-none transition-colors" />
              </div>
              <button onClick={handlePhone} disabled={phone.length < 9 || loading}
                className="w-full h-14 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
                {loading ? <><Clock className="w-5 h-5 animate-spin" /><span>Verificando...</span></> : 'Continuar'}
              </button>
              <p className="text-xs text-center text-muted-foreground">
                (Simulación: cualquier número de 9 dígitos)
              </p>
            </motion.div>
          )}
          {step === 'name' && (
            <motion.div key="name" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} className="w-full space-y-4">
              <label className="block text-sm font-medium">¿Cómo te llamas?</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Tu nombre" autoFocus
                className="w-full h-14 px-4 bg-input-background rounded-xl border-2 border-transparent focus:border-primary outline-none transition-colors" />
              <button onClick={handleLogin} disabled={!name.trim()}
                className="w-full h-14 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 disabled:opacity-50 transition-opacity">
                Entrar a SplitPay
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Slide>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

function HomeScreen({ groups, totalOwed, totalOwedToYou, pendingReminders, onGroupClick, onAddGroup, onProfile, onDiscounts }: {
  groups: Group[]; totalOwed: number; totalOwedToYou: number; pendingReminders: number;
  onGroupClick: (g: Group) => void; onAddGroup: () => void; onProfile: () => void; onDiscounts: () => void;
}) {
  const { user } = useApp();
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="flex-1 flex flex-col">
      <div className="bg-primary text-primary-foreground p-6 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1>SplitPay</h1>
            <p className="text-sm opacity-75">Hola, {user?.name ?? 'Usuario'}</p>
          </div>
          <div className="flex items-center gap-2">
            {user?.plan === 'premium' && (
              <div className="flex items-center gap-1 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold">
                <Crown className="w-3 h-3" />Premium
              </div>
            )}
            <button onClick={onProfile} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity">
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {totalOwed > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-90">Debes en total</span>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-lg font-medium text-red-400">S/ {totalOwed.toFixed(2)}</span>
              </div>
            </div>
          )}
          {totalOwedToYou > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-90">Te deben en total</span>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-lg font-medium text-green-400">S/ {totalOwedToYou.toFixed(2)}</span>
              </div>
            </div>
          )}
          {totalOwed === 0 && totalOwedToYou === 0 && (
            <div className="flex items-center gap-2 text-sm opacity-80">
              <CheckCircle2 className="w-4 h-4" /><span>Estás al día con todos tus grupos</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        <button onClick={onDiscounts}
          className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-4 text-left hover:border-yellow-300 transition-colors">
          <Tag className="w-5 h-5 text-orange-500 mb-2" />
          <div className="text-sm font-medium">Descuentos</div>
          <div className="text-xs text-muted-foreground">Restaurantes aliados</div>
        </button>
        <button onClick={onAddGroup}
          className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-4 text-left hover:border-primary/30 transition-colors">
          <Plus className="w-5 h-5 text-primary mb-2" />
          <div className="text-sm font-medium">Nuevo grupo</div>
          <div className="text-xs text-muted-foreground">Crear y dividir</div>
        </button>
      </div>

      <div className="flex-1 p-4 space-y-3 overflow-auto">
        <div className="flex items-center justify-between">
          <h4>Mis grupos</h4>
          {pendingReminders > 0 && (
            <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
              <Bell className="w-3 h-3" />{pendingReminders} recordatorio{pendingReminders > 1 ? 's' : ''} enviado{pendingReminders > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-16">
            <Users className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">Aún no tienes grupos.<br />Crea uno para empezar.</p>
          </div>
        )}

        {groups.map((group, i) => {
          const status = computeUserStatus(group);
          return (
            <motion.button key={group.id} initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
              transition={{ delay: i * 0.05 }} onClick={() => onGroupClick(group)}
              className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/20 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="mb-1">{group.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" /><span>{group.participants.length} personas</span>
                  </div>
                </div>
                <div className="text-right">
                  {status.type === 'owes'    && <div className="text-red-600"><div className="text-xs mb-1">Debes</div><div className="font-medium">S/ {status.amount.toFixed(2)}</div></div>}
                  {status.type === 'owed'    && <div className="text-green-600"><div className="text-xs mb-1">Te deben</div><div className="font-medium">S/ {status.amount.toFixed(2)}</div></div>}
                  {status.type === 'settled' && <div className="text-muted-foreground"><CheckCircle2 className="w-5 h-5" /></div>}
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">Gasto total</span>
                <span className="text-sm font-medium">S/ {computeTotalExpense(group).toFixed(2)}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── CreateGroupScreen ────────────────────────────────────────────────────────

function CreateGroupScreen({ onBack, onCreate }: { onBack: ()=>void; onCreate: (name:string, p:string[])=>void }) {
  const [groupName, setGroupName] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [newP, setNewP] = useState('');

  const add = () => {
    const t = newP.trim();
    if (t && !participants.includes(t) && t !== 'Tú') { setParticipants(p => [...p, t]); setNewP(''); }
  };

  return (
    <Slide dir="right">
      <PageHeader title="Crear grupo" onBack={onBack} />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div>
          <label className="block text-sm mb-2">Nombre del grupo</label>
          <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)}
            placeholder="Ej: Viaje a la playa" autoFocus
            className="w-full h-14 px-4 bg-input-background rounded-xl border-2 border-transparent focus:border-primary outline-none transition-colors" />
        </div>
        <div>
          <label className="block text-sm mb-2">Participantes</label>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm">Tú</span>
            {participants.map(p => (
              <span key={p} className="flex items-center gap-1 bg-muted px-3 py-1 rounded-full text-sm">
                {p}<button onClick={() => setParticipants(prev => prev.filter(x => x !== p))} className="ml-1 hover:opacity-70"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newP} onChange={e => setNewP(e.target.value)} onKeyDown={e => e.key==='Enter' && add()}
              placeholder="Nombre del participante"
              className="flex-1 h-12 px-4 bg-input-background rounded-xl border-2 border-transparent focus:border-primary outline-none transition-colors" />
            <button onClick={add} disabled={!newP.trim()}
              className="h-12 w-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:opacity-90 disabled:opacity-40">
              <UserPlus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-border">
        <button onClick={() => groupName.trim() && participants.length > 0 && onCreate(groupName.trim(), participants)}
          disabled={!groupName.trim() || participants.length === 0}
          className="w-full h-14 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 disabled:opacity-50">
          Crear grupo
        </button>
      </div>
    </Slide>
  );
}

// ─── GroupScreen ──────────────────────────────────────────────────────────────

function GroupScreen({ group, onBack, onAddExpense, onSettle, onReminders, onDeleteExpense, onDeleteGroup, showExpenseDetail, setShowExpenseDetail }: {
  group: Group; onBack:()=>void; onAddExpense:()=>void; onSettle:()=>void; onReminders:()=>void;
  onDeleteExpense:(id:string)=>void; onDeleteGroup:()=>void;
  showExpenseDetail: string|null; setShowExpenseDetail:(id:string|null)=>void;
}) {
  const balances = calculateBalances(group);
  const userBalance = getUserBalance(group);
  const isFullySettled = group.expenses.length > 0 && group.settledExpenseIds.length === group.expenses.length;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { reminders } = useApp();
  const groupReminders = reminders.filter(r => r.groupId === group.id && r.status === 'sent');

  return (
    <Slide dir="right">
      <div className="bg-primary text-primary-foreground p-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="p-2 -ml-2 hover:opacity-70"><ArrowLeft className="w-6 h-6" /></button>
          <div className="flex items-center gap-2">
            <button onClick={onReminders} className="relative p-2 hover:opacity-70">
              <Bell className="w-5 h-5" />
              {groupReminders.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {groupReminders.length}
                </span>
              )}
            </button>
            <button onClick={() => setConfirmDelete(true)} className="p-2 hover:opacity-70"><Trash2 className="w-5 h-5" /></button>
          </div>
        </div>
        <h2 className="mb-2">{group.name}</h2>
        <div className="flex items-center gap-2 text-sm opacity-90"><Users className="w-4 h-4" /><span>{group.participants.join(', ')}</span></div>
      </div>

      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            className="mx-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-sm text-red-800 mb-3">¿Eliminar <strong>{group.name}</strong>? Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={onDeleteGroup} className="flex-1 h-10 bg-red-600 text-white rounded-xl text-sm hover:opacity-90">Eliminar</button>
              <button onClick={() => setConfirmDelete(false)} className="flex-1 h-10 bg-muted rounded-xl text-sm">Cancelar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-auto">
        {group.expenses.length > 0 && (
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <h4>Resumen de deudas</h4>
              <div className={`px-2 py-1 rounded-full text-xs ${isFullySettled ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {isFullySettled ? 'Saldado' : 'Pendiente'}
              </div>
            </div>
            {!isFullySettled && (
              <>
                <div className="space-y-2 mb-4">
                  {balances.map((b, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{b.from}</span>
                      <span className="text-muted-foreground"> debe a </span>
                      <span className="font-medium">{b.to}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="font-medium">S/ {b.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                {userBalance !== 0 && (
                  <div className={`p-3 rounded-xl mb-3 ${userBalance < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Tu saldo</span>
                      <span className={`font-medium ${userBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {userBalance < 0 ? 'Debes' : 'Te deben'} S/ {Math.abs(userBalance).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
                <button onClick={onSettle} className="w-full h-12 bg-primary text-primary-foreground rounded-xl hover:opacity-90">
                  Saldar todo
                </button>
              </>
            )}
            {isFullySettled && (
              <div className="flex items-center gap-2 text-green-700 text-sm">
                <CheckCircle2 className="w-5 h-5" /><span>Todas las deudas han sido saldadas</span>
              </div>
            )}
          </div>
        )}

        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4>Gastos ({group.expenses.length})</h4>
            <button onClick={onAddExpense} className="flex items-center gap-1 text-sm text-primary hover:opacity-70">
              <Plus className="w-4 h-4" /><span>Agregar</span>
            </button>
          </div>

          {group.expenses.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay gastos aún.<br />Agrega el primero.</p>
            </div>
          )}

          <div className="space-y-2">
            {group.expenses.map(expense => {
              const isSettled = group.settledExpenseIds.includes(expense.id);
              return (
                <div key={expense.id}>
                  <button onClick={() => setShowExpenseDetail(showExpenseDetail === expense.id ? null : expense.id)}
                    className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary/20 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Receipt className={`w-4 h-4 ${isSettled ? 'text-green-500' : 'text-muted-foreground'}`} />
                          <span className={`font-medium ${isSettled ? 'line-through text-muted-foreground' : ''}`}>{expense.name}</span>
                          {isSettled && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Saldado</span>}
                        </div>
                        <div className="text-sm text-muted-foreground">Pagado por {expense.paidBy}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">S/ {expense.amount.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">{expense.date}</div>
                      </div>
                    </div>
                  </button>
                  <AnimatePresence>
                    {showExpenseDetail === expense.id && (
                      <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} className="overflow-hidden">
                        <div className="bg-muted/50 rounded-xl p-4 mt-2 ml-4 text-sm">
                          <div className="font-medium mb-2">Desglose:</div>
                          <div className="space-y-1 mb-3">
                            {expense.participants.map(p => (
                              <div key={p} className="flex justify-between">
                                <span>{p}</span>
                                <span className="text-muted-foreground">S/ {(expense.amount / expense.participants.length).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          <button onClick={() => { onDeleteExpense(expense.id); setShowExpenseDetail(null); }}
                            className="flex items-center gap-1 text-red-600 hover:opacity-70 text-xs">
                            <Trash2 className="w-3 h-3" />Eliminar gasto
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Slide>
  );
}

// ─── AddExpenseScreen ─────────────────────────────────────────────────────────

function AddExpenseScreen({ group, onBack, onSave, onScan }: {
  group: Group; onBack:()=>void; onSave:(e: Omit<Expense,'id'|'date'>)=>void; onScan:()=>void;
}) {
  const [amount, setAmount] = useState('');
  const [name,   setName]   = useState('');
  const [paidBy, setPaidBy] = useState('Tú');
  const [sel,    setSel]    = useState<string[]>(group.participants);

  const toggle = (p: string) => setSel(prev => prev.includes(p) ? prev.filter(x => x!==p) : [...prev, p]);
  const perPerson = sel.length > 0 && parseFloat(amount) > 0 ? parseFloat(amount) / sel.length : null;

  const save = () => {
    const a = parseFloat(amount);
    if (!a || !name.trim() || sel.length === 0) return;
    onSave({ name: name.trim(), amount: a, paidBy, participants: sel });
  };

  return (
    <Slide dir="up">
      <PageHeader title="Agregar gasto" subtitle={group.name} onBack={onBack} />

      {/* OCR button */}
      <div className="mx-6 mt-6">
        <button onClick={onScan}
          className="w-full h-14 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center gap-3 hover:opacity-90 transition-opacity">
          <ScanLine className="w-5 h-5" />
          <span className="font-medium">Escanear ticket</span>
          <span className="text-xs opacity-75 ml-auto mr-2">nuevo</span>
        </button>
      </div>

      <div className="flex items-center gap-3 px-6 my-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">o ingresa manualmente</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex-1 px-6 space-y-6 overflow-auto">
        <div>
          <label className="block text-sm mb-2">Monto (S/)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
            className="w-full h-14 px-4 bg-input-background rounded-xl border-2 border-transparent focus:border-primary outline-none transition-colors" />
          {perPerson !== null && <p className="text-xs text-muted-foreground mt-1">S/ {perPerson.toFixed(2)} por persona</p>}
        </div>
        <div>
          <label className="block text-sm mb-2">Descripción</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="¿Para qué fue el gasto?"
            className="w-full h-14 px-4 bg-input-background rounded-xl border-2 border-transparent focus:border-primary outline-none transition-colors" />
        </div>
        <div>
          <label className="block text-sm mb-2">Pagado por</label>
          <div className="grid grid-cols-2 gap-2">
            {group.participants.map(p => (
              <button key={p} onClick={() => setPaidBy(p)}
                className={`h-12 rounded-xl border-2 transition-colors ${paidBy===p ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/30'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm mb-2">Dividir entre</label>
          <div className="grid grid-cols-2 gap-2">
            {group.participants.map(p => (
              <button key={p} onClick={() => toggle(p)}
                className={`h-12 rounded-xl border-2 transition-colors ${sel.includes(p) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/30'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <button onClick={save} disabled={!amount || !name.trim() || sel.length === 0}
          className="w-full h-14 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 disabled:opacity-50">
          Guardar gasto
        </button>
      </div>
    </Slide>
  );
}

// ─── OCRScanScreen ────────────────────────────────────────────────────────────

function OCRScanScreen({ group, onBack, onConfirm }: {
  group: Group; onBack:()=>void; onConfirm:(e: Omit<Expense,'id'|'date'>)=>void;
}) {
  const [phase, setPhase]   = useState<'scanning'|'processing'|'result'>('scanning');
  const [paidBy, setPaidBy] = useState('Tú');
  const [sel,    setSel]    = useState<string[]>(group.participants);

  // Simulated OCR result
  const ocrResults = [
    { name: 'Almuerzo ejecutivo', amount: 85.50 },
    { name: 'Pizza familiar',     amount: 62.00 },
    { name: 'Cena Thai',          amount: 134.00 },
    { name: 'Café y postres',     amount: 47.80 },
  ];
  const [detected] = useState(() => ocrResults[Math.floor(Math.random() * ocrResults.length)]);
  const [name,   setName]   = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('processing'), 2000);
    const t2 = setTimeout(() => {
      setName(detected.name);
      setAmount(detected.amount.toString());
      setPhase('result');
    }, 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const toggle = (p: string) => setSel(prev => prev.includes(p) ? prev.filter(x => x!==p) : [...prev, p]);
  const perPerson = sel.length > 0 ? parseFloat(amount) / sel.length : 0;

  const confirm = () => {
    const a = parseFloat(amount);
    if (!a || !name.trim() || sel.length === 0) return;
    onConfirm({ name: name.trim(), amount: a, paidBy, participants: sel });
  };

  return (
    <Slide dir="up">
      <PageHeader title="Escanear ticket" onBack={onBack} />

      <div className="flex-1 flex flex-col overflow-auto">
        {/* Camera viewfinder */}
        <div className="relative bg-gray-900 mx-4 mt-4 rounded-2xl overflow-hidden" style={{ height: 220 }}>
          {phase === 'scanning' && (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white text-sm opacity-60">Apuntando a ticket simulado...</div>
              </div>
              {/* Scan line animation */}
              <motion.div
                className="absolute left-6 right-6 h-0.5 bg-violet-400 shadow-lg"
                style={{ boxShadow: '0 0 8px #7c3aed' }}
                animate={{ top: ['20%', '80%', '20%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
              {/* Corner brackets */}
              {[['top-4 left-4','border-t-2 border-l-2'],['top-4 right-4','border-t-2 border-r-2'],
                ['bottom-4 left-4','border-b-2 border-l-2'],['bottom-4 right-4','border-b-2 border-r-2']].map(([pos, cls], i) => (
                <div key={i} className={`absolute ${pos} w-6 h-6 border-violet-400 ${cls}`} />
              ))}
            </>
          )}
          {phase === 'processing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <ScanLine className="w-8 h-8 text-violet-400" />
              </motion.div>
              <span className="text-white text-sm">Procesando OCR...</span>
            </div>
          )}
          {phase === 'result' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
              <span className="text-white text-sm font-medium">¡Ticket detectado!</span>
            </div>
          )}
        </div>

        {phase !== 'result' && (
          <div className="flex-1 flex items-center justify-center text-center text-muted-foreground px-8 text-sm">
            {phase === 'scanning' ? 'Mantén el ticket dentro del recuadro' : 'Extrayendo datos del ticket...'}
          </div>
        )}

        {phase === 'result' && (
          <div className="p-4 space-y-4">
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-violet-700 text-sm font-medium mb-3">
                <ScanLine className="w-4 h-4" />Datos detectados por OCR
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Descripción detectada</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    className="w-full h-12 px-4 bg-white rounded-xl border-2 border-violet-200 focus:border-violet-400 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Monto detectado (S/)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    className="w-full h-12 px-4 bg-white rounded-xl border-2 border-violet-200 focus:border-violet-400 outline-none text-sm" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2">Pagado por</label>
              <div className="grid grid-cols-2 gap-2">
                {group.participants.map(p => (
                  <button key={p} onClick={() => setPaidBy(p)}
                    className={`h-12 rounded-xl border-2 text-sm transition-colors ${paidBy===p ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/30'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2">Dividir entre</label>
              <div className="grid grid-cols-2 gap-2">
                {group.participants.map(p => (
                  <button key={p} onClick={() => toggle(p)}
                    className={`h-12 rounded-xl border-2 text-sm transition-colors ${sel.includes(p) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/30'}`}>
                    {p}
                  </button>
                ))}
              </div>
              {sel.length > 0 && parseFloat(amount) > 0 && (
                <p className="text-xs text-muted-foreground mt-2">S/ {perPerson.toFixed(2)} por persona</p>
              )}
            </div>
          </div>
        )}
      </div>

      {phase === 'result' && (
        <div className="p-4 border-t border-border">
          <button onClick={confirm} disabled={!name.trim() || !amount || sel.length === 0}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 disabled:opacity-50">
            Confirmar y guardar gasto
          </button>
        </div>
      )}
    </Slide>
  );
}

// ─── SettlementScreen ─────────────────────────────────────────────────────────

function SettlementScreen({ group, onBack, onPay, onSettleAll, onSendReminder }: {
  group: Group; onBack:()=>void; onPay:()=>void; onSettleAll:()=>void;
  onSendReminder:(target:string, amount:number)=>void;
}) {
  const balances  = calculateBalances(group);
  const userDebts = balances.filter(b => b.from === 'Tú');
  const [sent, setSent] = useState<string[]>([]);

  const handleReminder = (target: string, amount: number) => {
    onSendReminder(target, amount);
    setSent(p => [...p, target]);
  };

  return (
    <Slide dir="up">
      <PageHeader title="Liquidar deudas" onBack={onBack} />
      <div className="flex-1 p-6 overflow-auto">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-sm text-blue-900">Pagos optimizados para saldar todas las deudas con el mínimo de transacciones.</p>
          </div>
        </div>

        <h4 className="mb-4">Pagos optimizados</h4>

        {balances.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-500" />
            <p className="text-sm">No hay deudas pendientes.</p>
          </div>
        )}

        <div className="space-y-3">
          {balances.map((b, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">{b.from[0]}</span>
                  </div>
                  <div>
                    <div className="font-medium">{b.from}</div>
                    <div className="text-xs text-muted-foreground">paga a {b.to}</div>
                  </div>
                </div>
                <div className="font-medium">S/ {b.amount.toFixed(2)}</div>
              </div>
              {/* Anonymous reminder button — only for others' debts */}
              {b.from !== 'Tú' && (
                <button
                  onClick={() => !sent.includes(b.from) && handleReminder(b.from, b.amount)}
                  className={`w-full h-9 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors ${
                    sent.includes(b.from)
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                  }`}
                >
                  <Bell className="w-3 h-3" />
                  {sent.includes(b.from) ? '✓ Recordatorio enviado (anónimo)' : 'Enviar recordatorio anónimo'}
                </button>
              )}
            </div>
          ))}
        </div>

        {userDebts.length > 0 && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <div className="text-sm text-red-900 mb-1">Tus pagos pendientes</div>
            <div className="text-lg font-medium text-red-600">S/ {userDebts.reduce((s,d) => s+d.amount, 0).toFixed(2)}</div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border space-y-3">
        {userDebts.length > 0 && (
          <button onClick={onPay} className="w-full h-14 bg-primary text-primary-foreground rounded-2xl hover:opacity-90">
            Pagar ahora (Yape / Plin)
          </button>
        )}
        {balances.length > 0 && (
          <button onClick={onSettleAll} className="w-full h-14 bg-green-600 text-white rounded-2xl hover:opacity-90">
            Marcar todo como pagado
          </button>
        )}
        <button onClick={onBack} className="w-full h-12 text-sm text-muted-foreground hover:opacity-70">Volver</button>
      </div>
    </Slide>
  );
}

// ─── PaymentScreen ────────────────────────────────────────────────────────────

function PaymentScreen({ group, onBack, onComplete }: {
  group: Group; onBack:()=>void; onComplete:()=>void;
}) {
  const [method, setMethod]     = useState<string | null>(null);
  const [processing, setProc]   = useState(false);
  const [done, setDone]         = useState(false);
  const [yapeCopied, setYapeCopied] = useState(false);

  const balances  = calculateBalances(group);
  const userDebts = balances.filter(b => b.from === 'Tú');
  const total     = userDebts.reduce((s, d) => s + d.amount, 0);

  const handlePay = () => {
    setProc(true);
    setTimeout(() => { setProc(false); setDone(true); setTimeout(onComplete, 1200); }, 2000);
  };

  const handleDeepLink = (app: string) => {
    // Simulated deep link — real integration would open Yape/Plin
    setYapeCopied(true);
    setTimeout(() => setYapeCopied(false), 2500);
  };

  return (
    <Slide dir="up">
      <PageHeader title="Realizar pago" onBack={onBack} />
      <div className="flex-1 p-6 overflow-auto">
        <div className="bg-card border-2 border-primary rounded-2xl p-6 mb-6 text-center">
          <div className="text-sm text-muted-foreground mb-2">Total a pagar</div>
          <div className="text-3xl font-medium">S/ {total.toFixed(2)}</div>
        </div>

        {userDebts.map((d,i) => (
          <div key={i} className="flex justify-between text-sm bg-muted/30 rounded-xl px-4 py-3 mb-2">
            <span>Pagas a <span className="font-medium">{d.to}</span></span>
            <span className="font-medium">S/ {d.amount.toFixed(2)}</span>
          </div>
        ))}

        {/* Yape / Plin deep link buttons */}
        <div className="mt-6 mb-4">
          <h4 className="mb-3">Pago rápido</h4>
          <div className="grid grid-cols-2 gap-3">
            {['Yape','Plin'].map(app => (
              <button key={app} onClick={() => handleDeepLink(app)}
                className="h-16 rounded-xl border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors flex flex-col items-center justify-center gap-1">
                <span className="font-bold text-primary">{app}</span>
                <span className="text-xs text-muted-foreground">Abrir app</span>
              </button>
            ))}
          </div>
          {yapeCopied && (
            <motion.p initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }} className="text-xs text-center text-green-600 mt-2">
              ✓ Simulación: se abriría la app con el monto prellenado
            </motion.p>
          )}
        </div>

        <h4 className="mb-3">Otros métodos</h4>
        <div className="space-y-3 mb-6">
          {['Tarjeta','Transferencia bancaria'].map(m => (
            <button key={m} onClick={() => setMethod(m)} disabled={processing||done}
              className={`w-full h-14 rounded-xl border-2 flex items-center px-4 transition-colors ${method===m ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/30'}`}>
              <span className="font-medium">{m}</span>
            </button>
          ))}
        </div>

        <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
          Simulación: en producción, Yape y Plin se integrarían via deep links con monto y destinatario prellenados.
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <button onClick={handlePay} disabled={!method || processing || done}
          className={`w-full h-14 rounded-2xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 ${done ? 'bg-green-500' : 'bg-green-600'} text-white`}>
          {done ? <><CheckCircle2 className="w-5 h-5" /><span>¡Pago confirmado!</span></>
            : processing ? <><Clock className="w-5 h-5 animate-spin" /><span>Procesando...</span></>
            : <><Send className="w-5 h-5" /><span>Confirmar pago</span></>}
        </button>
      </div>
    </Slide>
  );
}

// ─── RemindersScreen ──────────────────────────────────────────────────────────

function RemindersScreen({ group, onBack, reminders, onSendReminder, onMarkPaid }: {
  group: Group; onBack:()=>void; reminders: Reminder[];
  onSendReminder:(target:string, amount:number)=>void;
  onMarkPaid:(id:string)=>void;
}) {
  const balances = calculateBalances(group);
  const otherDebts = balances.filter(b => b.from !== 'Tú');

  return (
    <Slide dir="right">
      <PageHeader title="Recordatorios anónimos" subtitle={group.name} onBack={onBack} />
      <div className="flex-1 p-6 overflow-auto space-y-6">

        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-orange-900">
              Los recordatorios se envían <strong>sin revelar tu nombre</strong>. El destinatario solo ve que tiene una deuda pendiente en SplitPay, sin saber quién lo pidió.
            </div>
          </div>
        </div>

        {otherDebts.length > 0 && (
          <div>
            <h4 className="mb-3">Deudas pendientes de otros</h4>
            <div className="space-y-3">
              {otherDebts.map((b, i) => {
                const alreadySent = reminders.some(r => r.targetUser === b.from && r.status === 'sent');
                return (
                  <div key={i} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium">{b.from}</div>
                        <div className="text-xs text-muted-foreground">debe a {b.to} · S/ {b.amount.toFixed(2)}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => !alreadySent && onSendReminder(b.from, b.amount)}
                      className={`w-full h-10 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors ${
                        alreadySent
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                      }`}
                    >
                      <Bell className="w-4 h-4" />
                      {alreadySent ? 'Recordatorio enviado ✓' : 'Recordar (anónimo)'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {reminders.length > 0 && (
          <div>
            <h4 className="mb-3">Historial de recordatorios</h4>
            <div className="space-y-2">
              {reminders.map(r => (
                <div key={r.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{r.targetUser}</div>
                    <div className="text-xs text-muted-foreground">
                      S/ {r.amount.toFixed(2)} · {new Date(r.sentAt).toLocaleDateString('es-PE')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${r.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {r.status === 'paid' ? 'Pagado' : 'Enviado'}
                    </span>
                    {r.status === 'sent' && (
                      <button onClick={() => onMarkPaid(r.id)} className="text-xs text-muted-foreground hover:opacity-70 underline">
                        Marcar pagado
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {otherDebts.length === 0 && reminders.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay deudas pendientes de otros participantes.</p>
          </div>
        )}
      </div>
    </Slide>
  );
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────

function ProfileScreen({ onBack, onUpgrade }: { onBack:()=>void; onUpgrade:()=>void }) {
  const { user, setUser } = useApp();
  if (!user) return null;

  return (
    <Slide dir="right">
      <PageHeader title="Mi perfil" onBack={onBack} />
      <div className="flex-1 p-6 space-y-6 overflow-auto">

        {/* Avatar */}
        <div className="flex flex-col items-center py-4">
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-3">
            <span className="text-3xl font-bold text-primary-foreground">{user.name[0].toUpperCase()}</span>
          </div>
          <h3>{user.name}</h3>
          <p className="text-sm text-muted-foreground">+51 {user.phone}</p>
          {user.plan === 'premium'
            ? <div className="mt-2 flex items-center gap-1 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium"><Crown className="w-4 h-4" />Plan Premium</div>
            : <div className="mt-2 text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">Plan Gratuito</div>
          }
        </div>

        {/* Plan comparison */}
        {user.plan === 'free' && (
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-5 h-5 text-yellow-600" />
              <span className="font-semibold text-yellow-900">Pásate a Premium</span>
            </div>
            <ul className="space-y-2 text-sm text-yellow-900 mb-4">
              {['Descuentos en restaurantes aliados','Recordatorios ilimitados','Historial de gastos sin límite','Sin comisiones por transacción'].map(f => (
                <li key={f} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />{f}</li>
              ))}
            </ul>
            <button onClick={onUpgrade} className="w-full h-12 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-medium hover:opacity-90">
              Ver planes
            </button>
          </div>
        )}

        {/* Menu items */}
        <div className="space-y-2">
          {[
            { icon: Bell, label: 'Notificaciones', sub: 'Gestionar alertas' },
            { icon: Tag, label: 'Descuentos', sub: user.plan === 'premium' ? 'Acceso activo' : 'Solo premium' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>

        <button onClick={() => setUser(null)}
          className="w-full h-12 border border-red-200 text-red-600 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition-colors">
          <LogOut className="w-4 h-4" />Cerrar sesión
        </button>
      </div>
    </Slide>
  );
}

// ─── SubscriptionScreen ───────────────────────────────────────────────────────

function SubscriptionScreen({ onBack }: { onBack:()=>void }) {
  const { user, setUser } = useApp();
  const [selected, setSelected] = useState<'monthly'|'annual'>('annual');
  const [processing, setProc]   = useState(false);
  const [done, setDone]         = useState(false);

  const plans = {
    monthly: { price: 'S/ 9.90', period: '/mes', saving: null },
    annual:  { price: 'S/ 79.90', period: '/año', saving: 'Ahorras S/ 38.90' },
  };

  const upgrade = () => {
    setProc(true);
    setTimeout(() => {
      if (user) setUser({ ...user, plan: 'premium' });
      setProc(false);
      setDone(true);
    }, 2000);
  };

  return (
    <Slide dir="up">
      <PageHeader title="Premium" onBack={onBack} />
      <div className="flex-1 p-6 overflow-auto">

        <div className="text-center mb-6">
          <Crown className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-1">Hazte Premium</h3>
          <p className="text-sm text-muted-foreground">Sin incomodidad. Sin olvidos. Sin conflictos.</p>
        </div>

        <div className="space-y-3 mb-6">
          {(['monthly','annual'] as const).map(k => (
            <button key={k} onClick={() => setSelected(k)}
              className={`w-full p-4 rounded-2xl border-2 text-left transition-colors ${selected===k ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{k === 'monthly' ? 'Mensual' : 'Anual'}</div>
                  {plans[k].saving && <div className="text-xs text-green-600 font-medium">{plans[k].saving}</div>}
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold">{plans[k].price}</span>
                  <span className="text-xs text-muted-foreground">{plans[k].period}</span>
                </div>
              </div>
              {k === 'annual' && <div className="mt-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full inline-block">Más popular</div>}
            </button>
          ))}
        </div>

        <div className="space-y-3 mb-6">
          {[
            { icon: ScanLine, title: 'OCR ilimitado', desc: 'Escanea todos los tickets que quieras' },
            { icon: Bell,     title: 'Recordatorios ilimitados', desc: 'Nunca más pierdas un cobro' },
            { icon: Tag,      title: 'Descuentos exclusivos', desc: 'Hasta 30% en restaurantes aliados' },
            { icon: TrendingDown, title: '0% de comisión', desc: 'Paga sin costos adicionales' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium">{title}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-center text-muted-foreground mb-4">
          Simulación: cobro vía Culqi/Izipay en producción
        </p>
      </div>

      <div className="p-4 border-t border-border">
        {done
          ? <div className="w-full h-14 bg-green-500 text-white rounded-2xl flex items-center justify-center gap-2 font-medium">
              <CheckCircle2 className="w-5 h-5" />¡Bienvenido a Premium!
            </div>
          : <button onClick={upgrade} disabled={processing || user?.plan === 'premium'}
              className="w-full h-14 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-2xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {processing ? <><Clock className="w-5 h-5 animate-spin" />Procesando...</> : user?.plan === 'premium' ? '¡Ya eres Premium!' : `Suscribirme · ${plans[selected].price}${plans[selected].period}`}
            </button>
        }
      </div>
    </Slide>
  );
}

// ─── DiscountsScreen ──────────────────────────────────────────────────────────

const DISCOUNTS = [
  { id:1, name:'La Lucha Sanguchería', category:'Comida rápida', discount:'15% OFF', min:'S/ 30', logo:'🥪', premium: false },
  { id:2, name:'Pardos Chicken',        category:'Pollos & parrillas', discount:'20% OFF', min:'S/ 50', logo:'🍗', premium: false },
  { id:3, name:'Sushi Roll',            category:'Japonesa',    discount:'25% OFF', min:'S/ 80', logo:'🍱', premium: true },
  { id:4, name:'Bembos',                category:'Hamburguesas', discount:'10% OFF', min:'S/ 25', logo:'🍔', premium: false },
  { id:5, name:'Don Belisario',         category:'Pollos',      discount:'30% OFF', min:'S/ 60', logo:'🍖', premium: true },
  { id:6, name:'Café Árabe',            category:'Cafetería',   discount:'20% OFF', min:'S/ 20', logo:'☕', premium: true },
];

function DiscountsScreen({ onBack, onUpgrade }: { onBack:()=>void; onUpgrade:()=>void }) {
  const { user } = useApp();
  const isPremium = user?.plan === 'premium';

  return (
    <Slide dir="right">
      <PageHeader title="Descuentos" subtitle="Restaurantes aliados" onBack={onBack} />
      <div className="flex-1 p-4 overflow-auto">

        {!isPremium && (
          <div className="mb-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-semibold text-yellow-900">Desbloquea descuentos exclusivos</span>
            </div>
            <p className="text-xs text-yellow-800 mb-3">Los descuentos marcados con 🔒 requieren plan Premium.</p>
            <button onClick={onUpgrade} className="w-full h-10 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl text-sm font-medium hover:opacity-90">
              Hazte Premium
            </button>
          </div>
        )}

        <div className="space-y-3">
          {DISCOUNTS.map(d => {
            const locked = d.premium && !isPremium;
            return (
              <div key={d.id} className={`bg-card border rounded-2xl p-4 transition-colors ${locked ? 'border-border opacity-60' : 'border-border hover:border-primary/20'}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                    {d.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{d.name}</span>
                      {d.premium && !isPremium && <span className="text-xs">🔒</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{d.category}</div>
                    <div className="text-xs text-muted-foreground">Pedido mínimo {d.min}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`font-bold text-sm ${locked ? 'text-muted-foreground' : 'text-green-600'}`}>{d.discount}</div>
                    {!locked && (
                      <button className="mt-1 text-xs bg-primary text-primary-foreground px-2 py-1 rounded-lg hover:opacity-90">
                        Usar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-center text-muted-foreground mt-4 pb-2">
          Simulación · En producción se integraría con el POS de cada local
        </p>
      </div>
    </Slide>
  );
}
