import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// Persistent database file location
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'database.json');

// System Users with Role-Based Access Control (RBAC)
export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  roleLabel: string;
  department: string;
}

const DEFAULT_SYSTEM_USERS: AppUser[] = [
  {
    id: 'usr-admin-1',
    name: 'Admin Traksi KPU',
    email: 'eztsel94@gmail.com',
    role: 'admin',
    roleLabel: 'Admin Utama',
    department: 'Traksi KPU - Kalimantan Plantation Unit',
  },
];

const INITIAL_TRUCKS: Array<{
  id: string;
  code: string;
  plateNumber: string;
  driverName: string;
  phone?: string;
  model: string;
  capacity: string;
  status: string;
  year: number;
  notes?: string;
}> = [];

const INITIAL_EXPENSES: Array<{
  id: string;
  date: string;
  truckId: string;
  category: string;
  description: string;
  amount: number;
  vendor: string;
  invoiceNumber?: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string;
}> = [];

interface DatabaseSchema {
  trucks: typeof INITIAL_TRUCKS;
  expenses: typeof INITIAL_EXPENSES;
  users: AppUser[];
  lastUpdated: string;
}

// Database Helper functions
function ensureDatabase(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialData: DatabaseSchema = {
      trucks: INITIAL_TRUCKS,
      expenses: INITIAL_EXPENSES,
      users: DEFAULT_SYSTEM_USERS,
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.trucks) && Array.isArray(parsed.expenses)) {
      if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
        parsed.users = DEFAULT_SYSTEM_USERS;
        saveDatabase(parsed);
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading database file, recreating default:', err);
  }

  const initialData: DatabaseSchema = {
    trucks: INITIAL_TRUCKS,
    expenses: INITIAL_EXPENSES,
    users: DEFAULT_SYSTEM_USERS,
    lastUpdated: new Date().toISOString(),
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  return initialData;
}

function saveDatabase(data: DatabaseSchema): void {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Extend Request type to include authenticated user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'admin' | 'operator' | 'viewer';
    name: string;
    email: string;
  };
}

// ================= RBAC MIDDLEWARE =================
// 1. Authenticate user from request headers
function authenticateUser(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const userId = req.headers['x-user-id'] as string;
  const userRole = (req.headers['x-user-role'] as string) || 'admin';
  const userName = (req.headers['x-user-name'] as string) || 'Admin User';
  const userEmail = (req.headers['x-user-email'] as string) || 'admin@traksikpu.com';

  req.user = {
    id: userId || 'usr-admin-1',
    role: (userRole === 'admin' || userRole === 'operator' || userRole === 'viewer') ? userRole : 'admin',
    name: userName,
    email: userEmail,
  };

  next();
}

// 2. Strict Admin Role Authorization Middleware
// Only users with role === 'admin' can modify, update, or delete expense records
function requireAdminRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'AKSES DITOLAK: Hanya user dengan role ADMIN yang berwenang untuk mengubah atau menghapus data pengeluaran biaya unit.',
      requiredRole: 'admin',
      currentRole: req.user?.role || 'anonymous',
    });
  }
  next();
}

// 3. Operator or Admin Authorization (e.g. for creating new expense log)
function requireOperatorOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'operator')) {
    return res.status(403).json({
      success: false,
      error: 'AKSES DITOLAK: Role Viewer (Hanya Lihat) tidak memiliki izin untuk mencatat pengeluaran baru.',
      requiredRole: 'operator | admin',
      currentRole: req.user?.role || 'anonymous',
    });
  }
  next();
}

app.use(authenticateUser);

// Real-time SSE Clients list
type SSEClient = {
  id: number;
  res: Response;
};

let clients: SSEClient[] = [];

function broadcastChange(type: string, payload: unknown, authorId?: string): void {
  const message = JSON.stringify({
    type,
    payload,
    authorId,
    timestamp: new Date().toISOString(),
  });

  clients.forEach((client) => {
    try {
      client.res.write(`data: ${message}\n\n`);
    } catch {
      // client may be closed
    }
  });
}

// ================= API ROUTES =================

// Users & Roles info endpoint
app.get('/api/users', (_req: Request, res: Response) => {
  const dbData = ensureDatabase();
  res.json({
    success: true,
    users: dbData.users,
  });
});

// Update User Role (STRICTLY ADMIN ONLY - WhatsApp style admin promotion/demotion)
app.put('/api/users/:id/role', requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { role, authorId } = req.body;

  if (role !== 'admin' && role !== 'operator' && role !== 'viewer') {
    return res.status(400).json({ error: 'Role tidak valid (harus admin, operator, atau viewer)' });
  }

  const dbData = ensureDatabase();
  const userIndex = dbData.users.findIndex((u) => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
  }

  const prevRole = dbData.users[userIndex].role;
  dbData.users[userIndex].role = role;

  if (role === 'admin') {
    dbData.users[userIndex].roleLabel = 'Admin / Kasir Kebun';
  } else if (role === 'operator') {
    dbData.users[userIndex].roleLabel = dbData.users[userIndex].roleLabel.includes('Supir')
      ? dbData.users[userIndex].roleLabel
      : 'Operator / Mandor Lapangan';
  } else {
    dbData.users[userIndex].roleLabel = 'Auditor (Hanya Lihat)';
  }

  saveDatabase(dbData);

  const updatedUser = dbData.users[userIndex];
  broadcastChange(
    'USER_ROLE_UPDATED',
    {
      userId: id,
      prevRole,
      newRole: role,
      updatedUser,
      authorName: req.user?.name || 'Admin',
      users: dbData.users,
    },
    authorId
  );

  res.json({ success: true, user: updatedUser, users: dbData.users });
});

// SSE Real-time Stream
app.get('/api/events', (_req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const clientId = Date.now() + Math.random();
  const newClient: SSEClient = { id: clientId, res };
  clients.push(newClient);

  // Send initial data snapshot
  const dbData = ensureDatabase();
  const welcomePayload = JSON.stringify({
    type: 'INIT',
    payload: {
      trucks: dbData.trucks,
      expenses: dbData.expenses,
      users: dbData.users,
      connectedClients: clients.length,
    },
    timestamp: new Date().toISOString(),
  });
  res.write(`data: ${welcomePayload}\n\n`);

  const pingInterval = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 25000);

  _req.on('close', () => {
    clearInterval(pingInterval);
    clients = clients.filter((c) => c.id !== clientId);
  });
});

// Fetch full data
app.get('/api/data', (_req: Request, res: Response) => {
  const dbData = ensureDatabase();
  res.json({
    success: true,
    trucks: dbData.trucks,
    expenses: dbData.expenses,
    lastUpdated: dbData.lastUpdated,
    connectedUsers: clients.length,
  });
});

// Add Expense (Requires Operator or Admin)
app.post('/api/expenses', requireOperatorOrAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { date, truckId, category, description, amount, vendor, invoiceNumber, authorId } = req.body;
  if (!truckId || !description || !amount || !vendor) {
    return res.status(400).json({ error: 'Data pengeluaran tidak lengkap' });
  }

  const dbData = ensureDatabase();
  const newExpense = {
    id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    date,
    truckId,
    category,
    description,
    amount: Number(amount),
    vendor,
    invoiceNumber: invoiceNumber || undefined,
    createdAt: new Date().toISOString(),
    createdBy: req.user?.id || 'usr-admin-1',
    createdByName: req.user?.name || 'Admin',
  };

  dbData.expenses.unshift(newExpense);
  saveDatabase(dbData);

  broadcastChange('EXPENSE_ADDED', { expense: newExpense, totalExpenses: dbData.expenses.length }, authorId);
  res.status(201).json({ success: true, expense: newExpense });
});

// Add Batch Expenses (Excel Import / Paste)
app.post('/api/expenses/batch', requireOperatorOrAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { expenses, authorId } = req.body;
  if (!Array.isArray(expenses) || expenses.length === 0) {
    return res.status(400).json({ error: 'Data pengeluaran tidak boleh kosong' });
  }

  const dbData = ensureDatabase();
  const createdExpenses: typeof INITIAL_EXPENSES = [];

  for (const item of expenses) {
    if (!item.truckId || !item.amount) continue;
    const newExpense = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      date: item.date || new Date().toISOString().split('T')[0],
      truckId: item.truckId,
      category: item.category || 'Sparepart',
      description: item.description || `Biaya ${item.category}`,
      amount: Number(item.amount) || 0,
      vendor: item.vendor || 'Vendor Mitra Kebun',
      invoiceNumber: item.invoiceNumber || undefined,
      createdAt: new Date().toISOString(),
      createdBy: req.user?.id || 'usr-admin-1',
      createdByName: req.user?.name || 'Admin',
    };
    createdExpenses.push(newExpense);
  }

  if (createdExpenses.length === 0) {
    return res.status(400).json({ error: 'Tidak ada data pengeluaran yang valid untuk disimpan' });
  }

  // Prepend batch to existing expenses
  dbData.expenses = [...createdExpenses, ...dbData.expenses];
  saveDatabase(dbData);

  broadcastChange(
    'EXPENSES_BATCH_ADDED',
    {
      expenses: createdExpenses,
      count: createdExpenses.length,
      totalExpenses: dbData.expenses.length,
      authorName: req.user?.name || 'Pengguna',
    },
    authorId
  );

  res.status(201).json({ success: true, count: createdExpenses.length, expenses: createdExpenses });
});

// Update Expense (STRICTLY ADMIN ONLY)
app.put('/api/expenses/:id', requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { authorId, ...updateData } = req.body;

  const dbData = ensureDatabase();
  const index = dbData.expenses.findIndex((e) => e.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Catatan biaya tidak ditemukan' });
  }

  // Audit trail: track who modified the expense
  dbData.expenses[index] = {
    ...dbData.expenses[index],
    ...updateData,
    updatedBy: req.user?.id,
    updatedByName: req.user?.name,
    updatedAt: new Date().toISOString(),
  };

  saveDatabase(dbData);

  broadcastChange('EXPENSE_UPDATED', { expense: dbData.expenses[index] }, authorId);
  res.json({ success: true, expense: dbData.expenses[index] });
});

// Delete Expense (STRICTLY ADMIN ONLY)
app.delete('/api/expenses/:id', requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const authorId = req.query.authorId as string | undefined;

  const dbData = ensureDatabase();
  const index = dbData.expenses.findIndex((e) => e.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Catatan biaya tidak ditemukan' });
  }

  const [deletedExpense] = dbData.expenses.splice(index, 1);
  saveDatabase(dbData);

  broadcastChange('EXPENSE_DELETED', { expenseId: id, deletedExpense }, authorId);
  res.json({ success: true, id });
});

// Add Truck Unit (STRICTLY ADMIN ONLY)
app.post('/api/trucks', requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
  const { code, plateNumber, driverName, phone, model, capacity, status, year, notes, authorId } = req.body;
  if (!code || !plateNumber || !driverName) {
    return res.status(400).json({ error: 'Data unit truk tidak lengkap' });
  }

  const dbData = ensureDatabase();

  // Cegah duplikasi unit truk (misal Unit 92 tidak akan muncul ganda)
  const normalizedCode = code.trim().toLowerCase();
  const normalizedPlate = plateNumber.trim().toLowerCase().replace(/\s+/g, '');

  const alreadyExists = dbData.trucks.find(
    (t) =>
      t.code.trim().toLowerCase() === normalizedCode ||
      t.plateNumber.trim().toLowerCase().replace(/\s+/g, '') === normalizedPlate
  );

  if (alreadyExists) {
    return res.status(409).json({
      error: `Unit truk ${code} (${plateNumber}) sudah terdaftar! Sistem mencegah duplikasi unit ganda.`,
      truck: alreadyExists,
    });
  }

  const newTruck = {
    id: `truck-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    code: code.trim(),
    plateNumber: plateNumber.trim().toUpperCase(),
    driverName: driverName.trim(),
    phone: phone || undefined,
    model: model || 'Truk Dump TBS',
    capacity: capacity || '8.5 Ton TBS',
    status: status || 'Aktif',
    year: Number(year) || 2022,
    notes: notes || undefined,
  };

  dbData.trucks.push(newTruck);

  // Otomatis masukkan operator / supir DT yang baru ke daftar akun atas (selaku supir saja)
  const existingDriver = dbData.users.find(
    (u) => u.name.toLowerCase().includes(driverName.toLowerCase()) || u.id === `usr-driver-${newTruck.id}`
  );

  let newDriverUser: AppUser | null = null;
  if (!existingDriver) {
    const slug = driverName.toLowerCase().replace(/[^a-z0-9]/g, '');
    newDriverUser = {
      id: `usr-driver-${newTruck.id}`,
      name: `${driverName} (Supir ${code})`,
      email: `${slug || 'supir'}@traksikpu.com`,
      role: 'operator', // Otomatis selaku supir saja
      roleLabel: `Supir DT (${code})`,
      department: `Armada Truk TBS - ${plateNumber}`,
    };
    dbData.users.push(newDriverUser);
  }

  saveDatabase(dbData);

  broadcastChange('TRUCK_ADDED', { truck: newTruck, newDriverUser, users: dbData.users }, authorId);
  if (newDriverUser) {
    broadcastChange('USERS_UPDATED', { users: dbData.users, newDriverUser }, authorId);
  }

  res.status(201).json({ success: true, truck: newTruck, newDriverUser, users: dbData.users });
});

// Update Truck Unit (STRICTLY ADMIN ONLY)
app.put('/api/trucks/:id', requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { authorId, ...updateData } = req.body;

  const dbData = ensureDatabase();
  const index = dbData.trucks.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Unit truk tidak ditemukan' });
  }

  dbData.trucks[index] = { ...dbData.trucks[index], ...updateData };
  saveDatabase(dbData);

  broadcastChange('TRUCK_UPDATED', { truck: dbData.trucks[index] }, authorId);
  res.json({ success: true, truck: dbData.trucks[index] });
});

// Delete Truck Unit (STRICTLY ADMIN ONLY)
app.delete('/api/trucks/:id', requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const deleteRelated = req.query.deleteRelated === 'true';
  const authorId = req.query.authorId as string | undefined;

  const dbData = ensureDatabase();
  const truckIndex = dbData.trucks.findIndex((t) => t.id === id);
  if (truckIndex === -1) {
    return res.status(404).json({ error: 'Unit truk tidak ditemukan' });
  }

  const [deletedTruck] = dbData.trucks.splice(truckIndex, 1);
  let deletedExpensesCount = 0;

  if (deleteRelated) {
    const prevCount = dbData.expenses.length;
    dbData.expenses = dbData.expenses.filter((e) => e.truckId !== id);
    deletedExpensesCount = prevCount - dbData.expenses.length;
  }

  saveDatabase(dbData);

  broadcastChange(
    'TRUCK_DELETED',
    {
      truckId: id,
      deletedTruck,
      deleteRelated,
      deletedExpensesCount,
      remainingExpenses: dbData.expenses,
    },
    authorId
  );

  res.json({ success: true, id, deletedExpensesCount });
});

// Reset Database (STRICTLY ADMIN ONLY)
app.post('/api/reset', requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
  const { authorId } = req.body || {};
  const dbData: DatabaseSchema = {
    trucks: INITIAL_TRUCKS,
    expenses: INITIAL_EXPENSES,
    users: DEFAULT_SYSTEM_USERS,
    lastUpdated: new Date().toISOString(),
  };

  saveDatabase(dbData);
  broadcastChange('DATABASE_RESET', { trucks: INITIAL_TRUCKS, expenses: INITIAL_EXPENSES, users: DEFAULT_SYSTEM_USERS }, authorId);
  res.json({ success: true, trucks: INITIAL_TRUCKS, expenses: INITIAL_EXPENSES, users: DEFAULT_SYSTEM_USERS });
});

// Import Database (STRICTLY ADMIN ONLY)
app.post('/api/import', requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
  const { trucks, expenses, authorId } = req.body;
  if (!Array.isArray(trucks) || !Array.isArray(expenses)) {
    return res.status(400).json({ error: 'Format data import tidak valid' });
  }

  const dbData: DatabaseSchema = {
    trucks,
    expenses,
    users: Array.isArray((req.body as any).users) ? (req.body as any).users : DEFAULT_SYSTEM_USERS,
    lastUpdated: new Date().toISOString(),
  };

  saveDatabase(dbData);
  broadcastChange('DATABASE_IMPORTED', { trucks, expenses, users: dbData.users }, authorId);
  res.json({ success: true });
});

// ================= FRONTEND VITE INTEGRATION =================
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Traksi KPU TBS Server running on http://0.0.0.0:${PORT} [${isProduction ? 'prod' : 'dev'}]`);
  });
}

startServer();
