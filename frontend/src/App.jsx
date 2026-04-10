import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');

  // Charger les tâches
  useEffect(() => {
    fetch('/api/tasks').then(res => res.json()).then(setTasks);
  }, []);

  // Ajouter une tâche
  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newTask })
    });
    const task = await res.json();
    setTasks([...tasks, task]);
    setNewTask('');
  };

  // Modifier l'état (Fait/À faire)
  const toggleTask = async (id) => {
    await fetch(`/api/tasks/${id}`, { method: 'PUT' });
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  // Supprimer une tâche
  const deleteTask = async (id) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setTasks(tasks.filter(t => t.id !== id));
  };

  return (
    <div className="app-container">
      <div className="todo-card">
        <h1 className="app-title">Todo List Azure</h1>
        
        <form onSubmit={addTask} className="add-form">
          <input 
            className="task-input"
            value={newTask} 
            onChange={(e) => setNewTask(e.target.value)} 
            placeholder="Que devez-vous faire aujourd'hui ?" 
          />
          <button type="submit" className="btn btn-primary">Ajouter</button>
        </form>

        <ul className="task-list">
          {tasks.map(task => (
            <li key={task.id} className={`task-item ${task.done ? 'is-done' : ''}`}>
              
              <div className="task-info">
                <span className="task-text">{task.text}</span>
                <span className={`badge ${task.done ? 'badge-done' : 'badge-todo'}`}>
                  {task.done ? 'Terminé' : 'À faire'}
                </span>
              </div>

              <div className="task-actions">
                <button 
                  onClick={() => toggleTask(task.id)} 
                  className={`btn ${task.done ? 'btn-warning' : 'btn-success'}`}
                >
                  {task.done ? 'Annuler' : 'Valider'}
                </button>
                <button 
                  onClick={() => deleteTask(task.id)} 
                  className="btn btn-danger"
                >
                  Supprimer
                </button>
              </div>

            </li>
          ))}
          {tasks.length === 0 && (
            <p className="empty-state">Aucune tâche pour le moment. À vous de jouer !</p>
          )}
        </ul>
      </div>
    </div>
  );
}

export default App;