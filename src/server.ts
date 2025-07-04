import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Rotas
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Servidor rodando com TypeScript!' });
});

app.get('/api/users', (req: Request, res: Response) => {
  const users = [
    { id: 1, name: 'João' },
    { id: 2, name: 'Maria' }
  ];
  res.json(users);
});

app.post('/api/users', (req: Request, res: Response) => {
  const { name } = req.body;
  res.json({ id: Date.now(), name });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});