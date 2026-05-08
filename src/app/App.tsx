import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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

type Screen = 'home' | 'group' | 'add-expense' | 'settlement' | 'payment' | 'create-group';

type Group = {
  id: string;
  name: string;
  participants: string[];
  settledExpenseIds: string[];
  expenses: Expense[];
};

type Expense = {
  id: string;
  name: string;
  amount: number;
  paidBy: string;
  participants: string[];
  date: string;
};

type Balance = {
  from: string;
  to: string;
  amount: number;
};

function computeTotalExpense(group: Group): number {
  return group.expenses.reduce((s, e) => s + e.amount, 0);
}

function computeUserStatus(group: Group, user = 'Tú'): { type: 'owes' | 'owed' | 'settled'; amount: number } {
  const bal = getUserBalance(group, user);
  if (bal < -0.01) return { type: 'owes', amount: Math.abs(bal) };
  if (bal > 0.01) return { type: 'owed', amount: bal };
  return { type: 'settled', amount: 0 };
}

function calculateBalances(group: Group): Balance[] {
  const balances: Record<string, number> = {};
  group.participants.forEach(p => (balances[p] = 0));
  group.expenses.forEach(expense => {
    const share = expense.amount / expense.participants.length;
    expense.participants.forEach(participant => { balances[participant] -= share; });
    balances[expense.paidBy] += expense.amount;
  });
  const debts: Balance[] = [];
  const creditors = Object.entries(balances).filter(([, amt]) => amt > 0.01);
  const debtors = Object.entries(balances).filter(([, amt]) => amt < -0.01);
  debtors.forEach(([debtor, debtAmount]) => {
    let remaining = Math.abs(debtAmount);
    creditors.forEach(([creditor, creditAmount]) => {
      if (remaining > 0.01 && creditAmount > 0.01) {
        const transfer = Math.min(remaining, creditAmount);
        debts.push({ from: debtor, to: creditor, amount: transfer });
        remaining -= transfer;
        balances[creditor] -= transfer;
      }
    });
  });
  return debts;
}

function getUserBalance(group: Group, user = 'Tú'): number {
  const balances: Record<string, number> = {};
  group.participants.forEach(p => (balances[p] = 0));
  group.expenses.forEach(expense => {
    const share = expense.amount / expense.participants.length;
    expense.participants.forEach(participant => { balances[participant] -= share; });
    balances[expense.paidBy] += expense.amount;
  });
  return balances[user] || 0;
}

const STORAGE_KEY = 'splitpay_groups';

const defaultGroups: Group[] = [
  {
    id: '1', name: 'Viaje a Cusco',
    participants: ['Tú', 'Ana', 'Carlos', 'María'],
    settledExpenseIds: [],
    expenses: [
      { id: 'e1', name: 'Hotel', amount: 480, paidBy: 'Ana', participants: ['Tú', 'Ana', 'Carlos', 'María'], date: '2026-04-08' },
      { id: 'e2', name: 'Cena en Cusco', amount: 156.50, paidBy: 'Carlos', participants: ['Tú', 'Ana', 'Carlos', 'María'], date: '2026-04-08' },
      { id: 'e3', name: 'Tour Machu Picchu', amount: 320, paidBy: 'Tú', participants: ['Tú', 'Ana', 'Carlos'], date: '2026-04-09' },
      { id: 'e4', name: 'Transporte', amount: 84, paidBy: 'María', participants: ['Tú', 'Ana', 'Carlos', 'María'], date: '2026-04-09' },
      { id: 'e5', name: 'Almuerzo mercado', amount: 200, paidBy: 'Ana', participants: ['Tú', 'Ana', 'Carlos', 'María'], date: '2026-04-10' },
    ],
  },
  {
    id: '2', name: 'Cena oficina',
    participants: ['Tú', 'Juan', 'Luis'],
    settledExpenseIds: [],
    expenses: [
      { id: 'e6', name: 'Pizza', amount: 120, paidBy: 'Tú', participants: ['Tú', 'Juan', 'Luis'], date: '2026-04-09' },
      { id: 'e7', name: 'Bebidas', amount: 60, paidBy: 'Tú', participants: ['Tú', 'Juan', 'Luis'], date: '2026-04-09' },
    ],
  },
  {
    id: '3', name: 'Casa de playa',
    participants: ['Tú', 'Sofia', 'Diego'],
    settledExpenseIds: ['e8', 'e9'],
    expenses: [
      { id: 'e8', name: 'Alquiler casa', amount: 600, paidBy: 'Sofia', participants: ['Tú', 'Sofia', 'Diego'], date: '2026-04-01' },
      { id: 'e9', name: 'Comida', amount: 150, paidBy: 'Diego', participants: ['Tú', 'Sofia', 'Diego'], date: '2026-04-02' },
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

function saveGroups(groups: Group[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

export default function App() {
  const [groups, setGroups] = useState<Group[]>(loadGroups);
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showExpenseDetail, setShowExpenseDetail] = useState<string | null>(null);

  useEffect(() => { saveGroups(groups); }, [groups]);

  const selectedGroup = groups.find(g => g.id === selectedGroupId) ?? null;

  const totalOwed = groups.reduce((sum, g) => {
    const s = computeUserStatus(g);
    return s.type === 'owes' ? sum + s.amount : sum;
  }, 0);

  const totalOwedToYou = groups.reduce((sum, g) => {
    const s = computeUserStatus(g);
    return s.type === 'owed' ? sum + s.amount : sum;
  }, 0);

  const goToGroup = (group: Group) => {
    setSelectedGroupId(group.id);
    setShowExpenseDetail(null);
    setScreen('group');
  };

  const goBack = () => {
    if (screen === 'group') { setScreen('home'); setSelectedGroupId(null); }
    else if (screen === 'create-group') setScreen('home');
    else setScreen('group');
  };

  const handleCreateGroup = (name: string, participants: string[]) => {
    const newGroup: Group = {
      id: Date.now().toString(), name,
      participants: ['Tú', ...participants],
      settledExpenseIds: [], expenses: [],
    };
    setGroups(prev => [newGroup, ...prev]);
    setSelectedGroupId(newGroup.id);
    setScreen('group');
  };

  const handleAddExpense = (groupId: string, expense: Omit<Expense, 'id' | 'date'>) => {
    setGroups(prev => prev.map(g => g.id !== groupId ? g : {
      ...g,
      expenses: [...g.expenses, { ...expense, id: `e-${Date.now()}`, date: new Date().toISOString().slice(0, 10) }],
    }));
    setScreen('group');
  };

  const handleDeleteExpense = (groupId: string, expenseId: string) => {
    setGroups(prev => prev.map(g => g.id !== groupId ? g : {
      ...g,
      expenses: g.expenses.filter(e => e.id !== expenseId),
      settledExpenseIds: g.settledExpenseIds.filter(id => id !== expenseId),
    }));
  };

  const handleDeleteGroup = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setScreen('home');
    setSelectedGroupId(null);
  };

  const handleSettleAll = (groupId: string) => {
    setGroups(prev => prev.map(g => g.id !== groupId ? g : {
      ...g, settledExpenseIds: g.expenses.map(e => e.id),
    }));
    setScreen('group');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md min-h-[812px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {screen === 'home' && (
            <HomeScreen key="home" groups={groups} totalOwed={totalOwed} totalOwedToYou={totalOwedToYou}
              onGroupClick={goToGroup} onAddGroup={() => setScreen('create-group')} />
          )}
          {screen === 'create-group' && (
            <CreateGroupScreen key="create-group" onBack={goBack} onCreate={handleCreateGroup} />
          )}
          {screen === 'group' && selectedGroup && (
            <GroupScreen key="group" group={selectedGroup} onBack={goBack}
              onAddExpense={() => setScreen('add-expense')} onSettle={() => setScreen('settlement')}
              onDeleteExpense={(id) => handleDeleteExpense(selectedGroup.id, id)}
              onDeleteGroup={() => handleDeleteGroup(selectedGroup.id)}
              showExpenseDetail={showExpenseDetail} setShowExpenseDetail={setShowExpenseDetail} />
          )}
          {screen === 'add-expense' && selectedGroup && (
            <AddExpenseScreen key="add-expense" group={selectedGroup} onBack={goBack}
              onSave={(expense) => handleAddExpense(selectedGroup.id, expense)} />
          )}
          {screen === 'settlement' && selectedGroup && (
            <SettlementScreen key="settlement" group={selectedGroup} onBack={goBack}
              onPay={() => setScreen('payment')} onSettleAll={() => handleSettleAll(selectedGroup.id)} />
          )}
          {screen === 'payment' && selectedGroup && (
            <PaymentScreen key="payment" group={selectedGroup} onBack={goBack}
              onComplete={() => handleSettleAll(selectedGroup.id)} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function HomeScreen({ groups, totalOwed, totalOwedToYou, onGroupClick, onAddGroup }: {
  groups: Group[]; totalOwed: number; totalOwedToYou: number;
  onGroupClick: (group: Group) => void; onAddGroup: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
      <div className="bg-primary text-primary-foreground p-6 pb-8">
        <h1 className="mb-6">SplitPay</h1>
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
              <CheckCircle2 className="w-4 h-4" />
              <span>Estás al día con todos tus grupos</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3 overflow-auto">
        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-16">
            <Users className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">Aún no tienes grupos.<br />Crea uno para empezar.</p>
          </div>
        )}
        {groups.map((group, index) => {
          const status = computeUserStatus(group);
          return (
            <motion.button key={group.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }} onClick={() => onGroupClick(group)}
              className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/20 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="mb-1">{group.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{group.participants.length} personas</span>
                  </div>
                </div>
                <div className="text-right">
                  {status.type === 'owes' && <div className="text-red-600"><div className="text-xs mb-1">Debes</div><div className="font-medium">S/ {status.amount.toFixed(2)}</div></div>}
                  {status.type === 'owed' && <div className="text-green-600"><div className="text-xs mb-1">Te deben</div><div className="font-medium">S/ {status.amount.toFixed(2)}</div></div>}
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

      <button onClick={onAddGroup} className="m-4 mt-0 h-14 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
        <Plus className="w-5 h-5" /><span>Crear grupo</span>
      </button>
    </motion.div>
  );
}

function CreateGroupScreen({ onBack, onCreate }: {
  onBack: () => void; onCreate: (name: string, participants: string[]) => void;
}) {
  const [groupName, setGroupName] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState('');

  const addParticipant = () => {
    const trimmed = newParticipant.trim();
    if (trimmed && !participants.includes(trimmed) && trimmed !== 'Tú') {
      setParticipants(prev => [...prev, trimmed]);
      setNewParticipant('');
    }
  };

  const canCreate = groupName.trim().length > 0 && participants.length > 0;

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="flex-1 flex flex-col">
      <div className="bg-primary text-primary-foreground p-6">
        <button onClick={onBack} className="mb-4 p-2 -ml-2 hover:opacity-70 transition-opacity"><ArrowLeft className="w-6 h-6" /></button>
        <h2>Crear grupo</h2>
      </div>

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
                {p}
                <button onClick={() => setParticipants(prev => prev.filter(x => x !== p))} className="hover:opacity-70 ml-1">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newParticipant} onChange={e => setNewParticipant(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addParticipant()}
              placeholder="Nombre del participante"
              className="flex-1 h-12 px-4 bg-input-background rounded-xl border-2 border-transparent focus:border-primary outline-none transition-colors" />
            <button onClick={addParticipant} disabled={!newParticipant.trim()}
              className="h-12 w-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity">
              <UserPlus className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Agrega al menos un participante además de ti.</p>
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <button onClick={() => canCreate && onCreate(groupName.trim(), participants)} disabled={!canCreate}
          className="w-full h-14 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50">
          Crear grupo
        </button>
      </div>
    </motion.div>
  );
}

function GroupScreen({ group, onBack, onAddExpense, onSettle, onDeleteExpense, onDeleteGroup, showExpenseDetail, setShowExpenseDetail }: {
  group: Group; onBack: () => void; onAddExpense: () => void; onSettle: () => void;
  onDeleteExpense: (expenseId: string) => void; onDeleteGroup: () => void;
  showExpenseDetail: string | null; setShowExpenseDetail: (id: string | null) => void;
}) {
  const balances = calculateBalances(group);
  const userBalance = getUserBalance(group);
  const isFullySettled = group.settledExpenseIds.length === group.expenses.length && group.expenses.length > 0;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
      <div className="bg-primary text-primary-foreground p-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="p-2 -ml-2 hover:opacity-70 transition-opacity"><ArrowLeft className="w-6 h-6" /></button>
          <button onClick={() => setConfirmDelete(true)} className="p-2 hover:opacity-70 transition-opacity"><Trash2 className="w-5 h-5" /></button>
        </div>
        <h2 className="mb-2">{group.name}</h2>
        <div className="flex items-center gap-2 text-sm opacity-90">
          <Users className="w-4 h-4" /><span>{group.participants.join(', ')}</span>
        </div>
      </div>

      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-sm text-red-800 mb-3">¿Eliminar el grupo <strong>{group.name}</strong>? Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={onDeleteGroup} className="flex-1 h-10 bg-red-600 text-white rounded-xl text-sm hover:opacity-90 transition-opacity">Eliminar</button>
              <button onClick={() => setConfirmDelete(false)} className="flex-1 h-10 bg-muted rounded-xl text-sm hover:opacity-80 transition-opacity">Cancelar</button>
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
                  {balances.map((balance, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{balance.from}</span>
                      <span className="text-muted-foreground"> debe a </span>
                      <span className="font-medium">{balance.to}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="font-medium">S/ {balance.amount.toFixed(2)}</span>
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
                <button onClick={onSettle} className="w-full h-12 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity">
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
            <button onClick={onAddExpense} className="flex items-center gap-1 text-sm text-primary hover:opacity-70 transition-opacity">
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
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
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
                            className="flex items-center gap-1 text-red-600 hover:opacity-70 transition-opacity text-xs">
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
    </motion.div>
  );
}

function AddExpenseScreen({ group, onBack, onSave }: {
  group: Group; onBack: () => void; onSave: (expense: Omit<Expense, 'id' | 'date'>) => void;
}) {
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [paidBy, setPaidBy] = useState('Tú');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(group.participants);

  const toggleParticipant = (p: string) =>
    setSelectedParticipants(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const perPerson = selectedParticipants.length > 0 && parseFloat(amount) > 0
    ? parseFloat(amount) / selectedParticipants.length : null;

  const handleSave = () => {
    const parsed = parseFloat(amount);
    if (!parsed || !name.trim() || selectedParticipants.length === 0) return;
    onSave({ name: name.trim(), amount: parsed, paidBy, participants: selectedParticipants });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col">
      <div className="bg-primary text-primary-foreground p-6">
        <button onClick={onBack} className="mb-4 p-2 -ml-2 hover:opacity-70 transition-opacity"><ArrowLeft className="w-6 h-6" /></button>
        <h2>Agregar gasto</h2>
        <p className="text-sm opacity-80 mt-1">{group.name}</p>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div>
          <label className="block text-sm mb-2">Monto (S/)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus
            className="w-full h-14 px-4 bg-input-background rounded-xl border-2 border-transparent focus:border-primary outline-none transition-colors" />
          {perPerson !== null && (
            <p className="text-xs text-muted-foreground mt-1">S/ {perPerson.toFixed(2)} por persona ({selectedParticipants.length} personas)</p>
          )}
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
                className={`h-12 rounded-xl border-2 transition-colors ${paidBy === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/30'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm mb-2">Dividir entre</label>
          <div className="grid grid-cols-2 gap-2">
            {group.participants.map(p => (
              <button key={p} onClick={() => toggleParticipant(p)}
                className={`h-12 rounded-xl border-2 transition-colors ${selectedParticipants.includes(p) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/30'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <button onClick={handleSave} disabled={!amount || !name.trim() || selectedParticipants.length === 0}
          className="w-full h-14 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50">
          Guardar gasto
        </button>
      </div>
    </motion.div>
  );
}

function SettlementScreen({ group, onBack, onPay, onSettleAll }: {
  group: Group; onBack: () => void; onPay: () => void; onSettleAll: () => void;
}) {
  const balances = calculateBalances(group);
  const userDebts = balances.filter(b => b.from === 'Tú');

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col">
      <div className="bg-primary text-primary-foreground p-6">
        <button onClick={onBack} className="mb-4 p-2 -ml-2 hover:opacity-70 transition-opacity"><ArrowLeft className="w-6 h-6" /></button>
        <h2>Liquidar deudas</h2>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="flex-1 text-sm text-blue-900">
              Estas transacciones minimizan el número de pagos necesarios para saldar todas las deudas del grupo.
            </div>
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
          {balances.map((balance, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">{balance.from[0]}</span>
                  </div>
                  <div>
                    <div className="font-medium">{balance.from}</div>
                    <div className="text-xs text-muted-foreground">paga a {balance.to}</div>
                  </div>
                </div>
                <div className="font-medium">S/ {balance.amount.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>

        {userDebts.length > 0 && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <div className="text-sm text-red-900 mb-1">Tus pagos pendientes</div>
            <div className="text-lg font-medium text-red-600">
              S/ {userDebts.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border space-y-3">
        {userDebts.length > 0 && (
          <button onClick={onPay} className="w-full h-14 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 transition-opacity">
            Pagar ahora
          </button>
        )}
        {balances.length > 0 && (
          <button onClick={onSettleAll} className="w-full h-14 bg-green-600 text-white rounded-2xl hover:opacity-90 transition-opacity">
            Marcar como pagado
          </button>
        )}
        <button onClick={onBack} className="w-full h-12 text-sm text-muted-foreground hover:opacity-70 transition-opacity">
          Volver
        </button>
      </div>
    </motion.div>
  );
}

function PaymentScreen({ group, onBack, onComplete }: {
  group: Group; onBack: () => void; onComplete: () => void;
}) {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const balances = calculateBalances(group);
  const userDebts = balances.filter(b => b.from === 'Tú');
  const totalAmount = userDebts.reduce((sum, d) => sum + d.amount, 0);

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setDone(true);
      setTimeout(onComplete, 1200);
    }, 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col">
      <div className="bg-primary text-primary-foreground p-6">
        <button onClick={onBack} className="mb-4 p-2 -ml-2 hover:opacity-70 transition-opacity"><ArrowLeft className="w-6 h-6" /></button>
        <h2>Realizar pago</h2>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="bg-card border-2 border-primary rounded-2xl p-6 mb-6 text-center">
          <div className="text-sm text-muted-foreground mb-2">Total a pagar</div>
          <div className="text-3xl font-medium">S/ {totalAmount.toFixed(2)}</div>
        </div>

        {userDebts.length > 0 && (
          <div className="mb-6 space-y-2">
            {userDebts.map((d, i) => (
              <div key={i} className="flex justify-between text-sm bg-muted/30 rounded-xl px-4 py-3">
                <span>Pagas a <span className="font-medium">{d.to}</span></span>
                <span className="font-medium">S/ {d.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <h4 className="mb-4">Método de pago</h4>
        <div className="space-y-3 mb-6">
          {['Yape', 'Plin', 'Tarjeta', 'Transferencia bancaria'].map(method => (
            <button key={method} onClick={() => setSelectedMethod(method)} disabled={processing || done}
              className={`w-full h-16 rounded-xl border-2 transition-colors flex items-center px-4 ${selectedMethod === method ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/30'}`}>
              <span className="font-medium">{method}</span>
            </button>
          ))}
        </div>

        <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
          Esta es una simulación de pago. En producción, se integraría con pasarelas de pago reales.
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <button onClick={handlePay} disabled={!selectedMethod || processing || done}
          className={`w-full h-14 rounded-2xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${done ? 'bg-green-500 text-white' : 'bg-green-600 text-white'}`}>
          {done ? (<><CheckCircle2 className="w-5 h-5" /><span>¡Pago confirmado!</span></>)
            : processing ? (<><Clock className="w-5 h-5 animate-spin" /><span>Procesando...</span></>)
            : (<><Send className="w-5 h-5" /><span>Confirmar pago</span></>)}
        </button>
      </div>
    </motion.div>
  );
}
