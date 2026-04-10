const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 8080; 

app.use(express.json());

let tasks = [];
let idCounter = 1;

// GET /api/tasks - Récupérer toutes les tâches
app.get('/api/tasks', (req, res) => {
    res.json(tasks);
});

// POST /api/tasks - Ajouter une nouvelle tâche
app.post('/api/tasks', (req, res) => {
    const task = { 
        id: idCounter++, 
        text: req.body.text, 
        done: false 
    };
    tasks.push(task);
    res.status(201).json(task);
});

// PUT /api/tasks/:id - Modifier l'état d'une tâche (Fait / À faire)
app.put('/api/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
        task.done = !task.done;
        res.json(task);
    } else {
        res.status(404).send('Tâche non trouvée');
    }
});

// DELETE /api/tasks/:id - Supprimer une tâche
app.delete('/api/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    tasks = tasks.filter(t => t.id !== taskId);
    res.status(204).send();
});

const frontendDistPath = path.join(__dirname, '../frontend/dist');

app.use(express.static(frontendDistPath));

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Serveur démarré avec succès sur le port ${PORT}`);
});