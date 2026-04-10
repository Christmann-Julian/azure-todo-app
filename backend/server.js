const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();

const PORT = process.env.PORT || 8080;

const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json());

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('Connecté à Cosmos DB avec succès !'))
        .catch(err => console.error('Erreur de connexion à la base de données:', err));
} else {
    console.warn("MONGODB_URI n'est pas définie. La base de données ne fonctionnera pas.");
}

const taskSchema = new mongoose.Schema({
    text: { type: String, required: true },
    done: { type: Boolean, default: false }
});

taskSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        delete returnedObject.__v;
    }
});

const Task = mongoose.model('Task', taskSchema);

// GET /api/tasks - Récupérer toutes les tâches
app.get('/api/tasks', async (req, res) => {
    const tasks = await Task.find({});
    res.json(tasks);
});

// POST /api/tasks - Ajouter une nouvelle tâche
app.post('/api/tasks', async (req, res) => {
    const task = new Task({
        text: req.body.text,
        done: false
    });
    const savedTask = await task.save();
    res.status(201).json(savedTask);
});

// PUT /api/tasks/:id - Modifier l'état d'une tâche
app.put('/api/tasks/:id', async (req, res) => {
    const task = await Task.findById(req.params.id);
    if (task) {
        task.done = !task.done;
        const updatedTask = await task.save();
        res.json(updatedTask);
    } else {
        res.status(404).send('Tâche non trouvée');
    }
});

// DELETE /api/tasks/:id - Supprimer une tâche
app.delete('/api/tasks/:id', async (req, res) => {
    await Task.findByIdAndDelete(req.params.id);
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