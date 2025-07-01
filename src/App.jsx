import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, where, setDoc, getDoc } from 'firebase/firestore';
import { Users, ListChecks, DollarSign, Briefcase, PlusCircle, Edit2, Trash2, Save, XCircle, CheckCircle, Circle, UserCircle2, AlertTriangle, LayoutDashboard, Table, Settings, CalendarHeart } from 'lucide-react';

// --- CONFIGURARE FIREBASE ---
const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
const appId = import.meta.env.VITE_APP_ID;

// --- COMPONENTE UTILITARE (MODAL, HOOKS) ---
const Modal = ({ isOpen, onClose, children, title, type = 'default' }) => {
  if (!isOpen) return null;
  let titleColor = 'text-gray-800';
  if (type === 'error') titleColor = 'text-red-600';
  if (type === 'warning') titleColor = 'text-yellow-600';
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md transform transition-all">
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-xl font-semibold ${titleColor}`}>{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><XCircle size={24} /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

const useAlertModal = () => {
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [alertTitle, setAlertTitle] = useState('Notificare');
    const showAlert = (message, title = 'Notificare') => { setAlertMessage(message); setAlertTitle(title); setIsAlertOpen(true); };
    const closeAlert = () => { setIsAlertOpen(false); setAlertMessage(''); setAlertTitle('Notificare'); };
    return { isAlertOpen, alertMessage, alertTitle, showAlert, closeAlert };
};

const useConfirmModal = () => {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [confirmTitle, setConfirmTitle] = useState('Confirmare');
    const [onConfirmAction, setOnConfirmAction] = useState(null);
    const showConfirm = (message, title = 'Confirmare', onConfirm) => { setConfirmMessage(message); setConfirmTitle(title); setOnConfirmAction(() => onConfirm); setIsConfirmOpen(true); };
    const closeConfirm = () => { setIsConfirmOpen(false); setConfirmMessage(''); setConfirmTitle('Confirmare'); setOnConfirmAction(null); };
    const handleConfirm = () => { if (onConfirmAction) { onConfirmAction(); } closeConfirm(); };
    return { isConfirmOpen, confirmMessage, confirmTitle, showConfirm, closeConfirm, handleConfirm };
};


// --- DATE PREDEFINITE DIN PDF ---
const defaultTaskCategories = {
    "10-12 Luni Înainte": ["Fixați data cununiei civile și religioase", "Verificați calendarul religios pentru posturi", "Stabiliți bugetul de nuntă și prioritățile", "Faceți o listă preliminară de invitați", "Alegeți nașii, domnișoarele și cavalerii de onoare", "Începeți căutarea locației și semnați contractul", "Rezervați biserica", "Angajați un wedding planner (opțional)"],
    "6-9 Luni Înainte": ["Alegeți și comandați rochia de mireasă și costumul de mire", "Comandați verighetele", "Rezervați fotograful, videograful și formația/DJ-ul", "Rezervați floristul și decoratorul", "Rezervați destinația pentru luna de miere"],
    "3-5 Luni Înainte": ["Stabiliți lista finală de invitați", "Trimiteți invitațiile și solicitați RSVP", "Alegeți și comandați mărturiile", "Stabiliți aranjamentele florale (mese, lumânări, mașini)", "Comandați buchetele (mireasă, nașă, domnișoare)", "Înscrieți-vă la cursuri de dans și alegeți melodia"],
    "2 Luni Înainte": ["Verificați actele necesare pentru starea civilă", "Comandați tortul de nuntă", "Stabiliți playlist-ul cu DJ-ul/formația", "Finalizați ținutele cu toate accesoriile", "Cumpărați cadoul pentru nași", "Rezervați cazare pentru invitații din alte localități"],
    "1 Lună Înainte": ["Cumpărați ținutele pentru cununia civilă", "Contactați toți furnizorii pentru confirmare finală", "Cumpărați băuturile (dacă nu sunt incluse în meniu)", "Închiriați mașina pentru transport"],
    "1-2 Săptămâni Înainte": ["Obțineți certificatele medicale prenupțiale", "Proba finală pentru ținute, coafură și machiaj", "Stabiliți detaliile finale ale meniului și degustarea", "Depuneți actele la primărie (cu 10 zile înainte)", "Confirmați numărul final de invitați la restaurant", "Completați place-cardurile și aranjarea la mese"],
    "Cu o zi înainte": ["Verificați decorul sălii", "Asigurați-vă că băuturile și aranjamentele au ajuns la local", "Întocmiți lista cu plățile pentru furnizori", "Pregătiți kit-ul de urgență", "Faceți bagajele pentru luna de miere", "Mergeți la salon pentru manichiură, pedichiură, etc.", "Relaxați-vă!"],
    "Lista Miresei": ["Rochie de mireasă", "Crinolină/Jupon", "Dres", "Lenjerie intimă", "Lenjerie pentru noaptea nunții", "Mănuși/Mitene", "Jartea", "Voal/Voaletă", "Bijuterii (colier, cercei, brățară)", "Pantofi de zi", "Pantofi de schimb (balerini)", "Diademă/Accesorii păr", "Poșetă/Săculeț", "Parfum și deodorant", "Stickere pentru pantofi", "Capă (pentru iarnă)"],
    "Lista Mirelui": ["Costum/Smoching", "Cămașă (+1 de schimb)", "Butoni cămașă", "Lavalieră/Papion/Cravată", "Vestă sau brâu", "Ac lavalieră", "Lenjerie intimă", "Curea", "Pantofi (+1 de schimb)", "Șosete asortate", "Batistă de buzunar", "Parfum și deodorant", "Stickere pentru pantofi"],
    "Kit de Urgență": ["Șervețele umede și uscate", "Medicamente pentru durere", "Ac, ață (albă și neagră), forfecuță", "Pilă de unghii și lac", "Gumă de mestecat", "Trusă mini de make-up", "Parfum", "Plasturi", "Ac de siguranță", "Deodorant", "Acte (CI, etc.)", "Bani cash", "Fixativ", "Tălpici de silicon pentru pantofi", "Haine pentru a doua zi"]
};

// --- Componente Specifice (Dashboard, GuestList, Budget, TodoList, VendorList, SeatingChart) ---

const Dashboard = ({ userId, weddingDate, stats, onSettingsClick }) => {
    const [countdown, setCountdown] = useState({});

    useEffect(() => {
        if (!weddingDate) return;

        const interval = setInterval(() => {
            const now = new Date();
            const wedding = new Date(weddingDate);
            const diff = wedding - now;

            if (diff <= 0) {
                setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                clearInterval(interval);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setCountdown({ days, hours, minutes, seconds });
        }, 1000);

        return () => clearInterval(interval);
    }, [weddingDate]);

    const StatCard = ({ icon: Icon, value, label, color }) => (
        <div className={`p-6 bg-white rounded-xl shadow-lg flex items-center space-x-4 border-l-4 ${color}`}>
            <div className="flex-shrink-0"><Icon className="h-8 w-8 text-gray-500" /></div>
            <div>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
                <p className="text-sm font-medium text-gray-500">{label}</p>
            </div>
        </div>
    );

    return (
        <div className="p-6 bg-gray-50 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-700 flex items-center"><CalendarHeart className="mr-3 text-pink-500"/> Panou de Bord</h2>
                <button onClick={onSettingsClick} className="text-gray-500 hover:text-pink-600 p-2 rounded-full hover:bg-pink-100 transition">
                    <Settings size={24} />
                </button>
            </div>
            
            {!weddingDate ? (
                <div className="text-center py-10 bg-pink-100 border border-pink-200 rounded-lg">
                    <p className="text-pink-700">Nu ai setat data nunții.</p>
                    <button onClick={onSettingsClick} className="mt-4 bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 px-6 rounded-lg shadow">Setează Data</button>
                </div>
            ) : (
                <div className="text-center p-8 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl shadow-2xl mb-8">
                    <h3 className="text-lg font-light tracking-wider">MAI SUNT</h3>
                    <div className="flex justify-center space-x-4 md:space-x-8 my-4">
                        <div><span className="text-5xl font-bold">{countdown.days || 0}</span><p>Zile</p></div>
                        <div><span className="text-5xl font-bold">{countdown.hours || 0}</span><p>Ore</p></div>
                        <div><span className="text-5xl font-bold">{countdown.minutes || 0}</span><p>Minute</p></div>
                        <div><span className="text-5xl font-bold">{countdown.seconds || 0}</span><p>Secunde</p></div>
                    </div>
                    <h3 className="text-lg font-light tracking-wider">PÂNĂ LA ZIUA CEA MARE</h3>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon={Users} value={`${stats.guestsConfirmed} / ${stats.guestsTotal}`} label="Invitați Confirmați" color="border-pink-500"/>
                <StatCard icon={DollarSign} value={`${stats.budgetSpent.toFixed(2)} RON`} label="Buget Cheltuit" color="border-green-500"/>
                <StatCard icon={ListChecks} value={`${stats.tasksCompleted} / ${stats.tasksTotal}`} label="Sarcini Finalizate" color="border-blue-500"/>
            </div>
        </div>
    );
};

const GuestList = ({ userId, showAlert, showConfirm }) => {
  const [guests, setGuests] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentGuest, setCurrentGuest] = useState(null);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestRsvp, setNewGuestRsvp] = useState('Așteaptă');
  const [newGuestNotes, setNewGuestNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const guestsCollectionPath = `artifacts/${appId}/users/${userId}/guests`;

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, guestsCollectionPath));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setGuests(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => showAlert(`Eroare la încărcarea listei de invitați: ${error.message}`, "Eroare de Date"));
    return () => unsubscribe();
  }, [userId, showAlert]);

  const handleAddOrUpdateGuest = async () => {
    if (!newGuestName.trim()) { showAlert("Numele invitatului este obligatoriu.", "Validare Eșuată"); return; }
    const guestData = { name: newGuestName, rsvp: newGuestRsvp, notes: newGuestNotes };
    try {
      if (currentGuest) {
        await updateDoc(doc(db, guestsCollectionPath, currentGuest.id), guestData);
        showAlert("Invitat actualizat!", "Succes");
      } else {
        await addDoc(collection(db, guestsCollectionPath), guestData);
        showAlert("Invitat adăugat!", "Succes");
      }
      closeModal();
    } catch (error) { showAlert(`A apărut o eroare la salvare: ${error.message}`, "Eroare Salvare"); }
  };

  const handleDeleteGuest = (guestId) => {
    showConfirm("Ești sigur că vrei să ștergi acest invitat?", "Confirmă Ștergerea", async () => {
        try { await deleteDoc(doc(db, guestsCollectionPath, guestId)); showAlert("Invitat șters!", "Succes"); } 
        catch (error) { showAlert(`A apărut o eroare la ștergere: ${error.message}`, "Eroare Ștergere"); }
    });
  };

  const openModal = (guest = null) => {
    setCurrentGuest(guest); setNewGuestName(guest?.name || ''); setNewGuestRsvp(guest?.rsvp || 'Așteaptă'); setNewGuestNotes(guest?.notes || '');
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false); setCurrentGuest(null); setNewGuestName(''); setNewGuestRsvp('Așteaptă'); setNewGuestNotes('');
  };

  const filteredGuests = guests.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-6 bg-pink-50 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-semibold text-pink-700">Listă Invitați</h2><button onClick={() => openModal()} className="bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center transition duration-150"><PlusCircle size={20} className="mr-2" /> Adaugă Invitat</button></div>
      <input type="text" placeholder="Caută invitat..." className="w-full p-2 mb-4 border border-pink-300 rounded-lg focus:ring-pink-500 focus:border-pink-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      {filteredGuests.length === 0 && <p className="text-gray-600">Niciun invitat găsit.</p>}
      <div className="space-y-4">{filteredGuests.map(guest => ( <div key={guest.id} className="bg-white p-4 rounded-lg shadow-sm border border-pink-200 flex justify-between items-start"><div><h3 className="text-lg font-medium text-pink-800">{guest.name}</h3><p className={`text-sm ${guest.rsvp === 'Confirmat' ? 'text-green-600' : guest.rsvp === 'Refuzat' ? 'text-red-600' : 'text-yellow-600'}`}>RSVP: {guest.rsvp}</p>{guest.notes && <p className="text-xs text-gray-500 mt-1">Notițe: {guest.notes}</p>}</div><div className="flex space-x-2"><button onClick={() => openModal(guest)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={18} /></button><button onClick={() => handleDeleteGuest(guest.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={18} /></button></div></div> ))}</div>
      <Modal isOpen={isModalOpen} onClose={closeModal} title={currentGuest ? "Modifică Invitat" : "Adaugă Invitat Nou"}>
          <div className="space-y-4">
              <div><label htmlFor="guestName" className="block text-sm font-medium text-gray-700">Nume Invitat:</label><input type="text" id="guestName" value={newGuestName} onChange={(e) => setNewGuestName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm" placeholder="Ex: Popescu Ion și Maria" /></div>
              <div><label htmlFor="guestRsvp" className="block text-sm font-medium text-gray-700">Status RSVP:</label><select id="guestRsvp" value={newGuestRsvp} onChange={(e) => setNewGuestRsvp(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm"><option value="Așteaptă">Așteaptă</option><option value="Confirmat">Confirmat</option><option value="Refuzat">Refuzat</option><option value="Poate">Poate</option></select></div>
              <div><label htmlFor="guestNotes" className="block text-sm font-medium text-gray-700">Notițe (opțional):</label><textarea id="guestNotes" value={newGuestNotes} onChange={(e) => setNewGuestNotes(e.target.value)} rows="3" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm" placeholder="Ex: Alergie la nuci, preferințe meniu, etc."></textarea></div>
              <div className="flex justify-end space-x-3"><button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md shadow-sm">Anulează</button><button onClick={handleAddOrUpdateGuest} className="px-4 py-2 text-sm font-medium text-white bg-pink-500 hover:bg-pink-600 rounded-md shadow-sm flex items-center"><Save size={16} className="mr-2" /> Salvează</button></div>
          </div>
      </Modal>
    </div>
  );
};

const Budget = ({ userId, showAlert, showConfirm }) => {
    const [items, setItems] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [itemName, setItemName] = useState('');
    const [category, setCategory] = useState('Locație');
    const [estimatedCost, setEstimatedCost] = useState('');
    const [actualCost, setActualCost] = useState('');
    const [isPaid, setIsPaid] = useState(false);
    const budgetCollectionPath = `artifacts/${appId}/users/${userId}/budgetItems`;
    const categories = ['Locație', 'Mâncare & Băutură', 'Fotograf/Videograf', 'Muzică/DJ', 'Ținute', 'Decorațiuni', 'Invitații', 'Verighete', 'Transport', 'Diverse'];
    useEffect(() => { if (!userId) return; const q = query(collection(db, budgetCollectionPath)); const unsubscribe = onSnapshot(q, (snap) => setItems(snap.docs.map(d => ({id: d.id, ...d.data()}))), (err) => showAlert(`Eroare buget: ${err.message}`, "Eroare")); return () => unsubscribe(); }, [userId, showAlert]);
    const handleAddOrUpdateItem = async () => { if (!itemName.trim() || !estimatedCost.trim()) { showAlert("Numele și costul estimat sunt obligatorii.", "Validare Eșuată"); return; } const itemData = { name: itemName, category, estimatedCost: parseFloat(estimatedCost) || 0, actualCost: actualCost ? (parseFloat(actualCost) || 0) : 0, paid: isPaid }; try { if (currentItem) await updateDoc(doc(db, budgetCollectionPath, currentItem.id), itemData); else await addDoc(collection(db, budgetCollectionPath), itemData); closeModal(); } catch (err) { showAlert(`Eroare salvare: ${err.message}`, "Eroare"); } };
    const handleDeleteItem = (itemId) => { showConfirm("Sigur ștergi această cheltuială?", "Confirmare", async () => { try { await deleteDoc(doc(db, budgetCollectionPath, itemId)); } catch (err) { showAlert(`Eroare ștergere: ${err.message}`, "Eroare"); } }); };
    const togglePaidStatus = async (item) => { try { await updateDoc(doc(db, budgetCollectionPath, item.id), { paid: !item.paid }); } catch (err) { showAlert(`Eroare actualizare: ${err.message}`, "Eroare"); } };
    const openModal = (item = null) => { setCurrentItem(item); setItemName(item?.name || ''); setCategory(item?.category || 'Locație'); setEstimatedCost(item?.estimatedCost?.toString() || ''); setActualCost(item?.actualCost?.toString() || ''); setIsPaid(item?.paid || false); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); };
    const totalEstimated = items.reduce((s, i) => s + (i.estimatedCost || 0), 0);
    const totalActual = items.reduce((s, i) => s + (i.actualCost || 0), 0);
    const totalPaid = items.filter(i => i.paid).reduce((s, i) => s + (i.actualCost || i.estimatedCost || 0), 0);
    return (
        <div className="p-6 bg-green-50 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-semibold text-green-700">Buget Nuntă</h2><button onClick={() => openModal()} className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center"><PlusCircle size={20} className="mr-2" /> Adaugă Cheltuială</button></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"><div className="p-4 bg-white rounded-lg shadow border-l-4 border-green-300"><h4 className="text-sm font-medium text-gray-500">Total Estimat</h4><p className="text-2xl font-bold text-green-700">{totalEstimated.toFixed(2)} RON</p></div><div className="p-4 bg-white rounded-lg shadow border-l-4 border-green-400"><h4 className="text-sm font-medium text-gray-500">Total Actual</h4><p className="text-2xl font-bold text-green-700">{totalActual.toFixed(2)} RON</p></div><div className="p-4 bg-white rounded-lg shadow border-l-4 border-green-500"><h4 className="text-sm font-medium text-gray-500">Total Plătit</h4><p className="text-2xl font-bold text-green-700">{totalPaid.toFixed(2)} RON</p></div></div>
            <div className="space-y-4">{items.map((item) => (<div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-green-200"><div className="flex justify-between items-start"><div><h3 className="text-lg font-medium text-green-800">{item.name} <span className="text-xs text-gray-500">({item.category})</span></h3><p className="text-sm text-gray-600">Estimat: {(item.estimatedCost || 0).toFixed(2)} RON</p>{item.actualCost > 0 && <p className="text-sm text-gray-600">Actual: {(item.actualCost || 0).toFixed(2)} RON</p>}</div><div className="flex items-center space-x-3"><button onClick={() => togglePaidStatus(item)} className={`p-1 rounded-full ${item.paid ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`} title={item.paid ? "Marchează ca neplătit" : "Marchează ca plătit"}>{item.paid ? <CheckCircle size={18} /> : <Circle size={18} />}</button><button onClick={() => openModal(item)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={18} /></button><button onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={18} /></button></div></div></div>))}</div>
            <Modal isOpen={isModalOpen} onClose={closeModal} title={currentItem ? "Modifică Cheltuială" : "Adaugă Cheltuială Nouă"}>{/* ... form ... */}</Modal>
        </div>
    );
};

const TodoList = ({ userId, showAlert, showConfirm }) => {
    const [tasks, setTasks] = useState({});
    const tasksCollectionPath = `artifacts/${appId}/users/${userId}/tasks`;

    useEffect(() => {
        if (!userId) return;
        const q = query(collection(db, tasksCollectionPath));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const tasksData = {};
            querySnapshot.forEach(doc => {
                const task = { id: doc.id, ...doc.data() };
                if (!tasksData[task.category]) tasksData[task.category] = [];
                tasksData[task.category].push(task);
            });
            setTasks(tasksData);
        }, (error) => showAlert(`Eroare la încărcarea sarcinilor: ${error.message}`, "Eroare"));
        return () => unsubscribe();
    }, [userId, showAlert]);
    
    const addDefaultTasks = () => {
        showConfirm("Vrei să adaugi lista standard de sarcini din ghid? Asta va adăuga peste 100 de sarcini organizate pe categorii.", "Adaugă Sarcini Standard", async () => {
            try {
                const existingTasksSnapshot = await getDocs(query(collection(db, tasksCollectionPath)));
                const existingTaskNames = new Set(existingTasksSnapshot.docs.map(d => d.data().name));
                let addedCount = 0;
                for (const category in defaultTaskCategories) {
                    for (const taskName of defaultTaskCategories[category]) {
                        if (!existingTaskNames.has(taskName)) {
                            await addDoc(collection(db, tasksCollectionPath), { name: taskName, category, completed: false });
                            addedCount++;
                        }
                    }
                }
                showAlert(`${addedCount} sarcini noi au fost adăugate!`, "Succes");
            } catch (error) { showAlert(`Eroare la adăugarea sarcinilor: ${error.message}`, "Eroare"); }
        });
    };

    const toggleCompleteTask = async (task) => {
        try { await updateDoc(doc(db, tasksCollectionPath, task.id), { completed: !task.completed }); } catch (error) { showAlert(`Eroare la actualizarea sarcinii: ${error.message}`, "Eroare"); }
    };

    const CategorySection = ({ title, tasksInCategory }) => {
        const [isOpen, setIsOpen] = useState(true);
        if (!tasksInCategory || tasksInCategory.length === 0) return null;
        const completedCount = tasksInCategory.filter(t => t.completed).length;
        const totalCount = tasksInCategory.length;
        const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
        return (
            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
                <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                    <h3 className="text-xl font-semibold text-blue-800">{title}</h3>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-500">{completedCount}/{totalCount}</span>
                        <div className="w-24 bg-gray-200 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div></div>
                        <XCircle size={20} className={`transform transition-transform ${isOpen ? 'rotate-45 text-blue-600' : 'text-gray-400'}`} />
                    </div>
                </div>
                {isOpen && <div className="mt-4 space-y-2">
                    {tasksInCategory.map(task => (
                        <div key={task.id} className="flex items-center">
                            <button onClick={() => toggleCompleteTask(task)} className={`mr-3 p-1 rounded-full ${task.completed ? 'text-green-500' : 'text-gray-400 hover:text-blue-500'}`}>{task.completed ? <CheckCircle size={22} /> : <Circle size={22} />}</button>
                            <span className={task.completed ? 'line-through text-gray-500' : 'text-gray-700'}>{task.name}</span>
                        </div>
                    ))}
                </div>}
            </div>
        )
    };
    
    return (
        <div className="p-6 bg-blue-50 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-blue-700">Listă de Sarcini</h2>
                <button onClick={addDefaultTasks} className="bg-yellow-400 hover:bg-yellow-500 text-yellow-800 font-semibold py-2 px-4 rounded-lg shadow flex items-center transition duration-150"><ListChecks size={20} className="mr-2" /> Adaugă Sarcini Standard</button>
            </div>
            <div className="space-y-4">
                {Object.keys(defaultTaskCategories).map(category => (
                    <CategorySection key={category} title={category} tasksInCategory={tasks[category]} />
                ))}
            </div>
        </div>
    );
};

const VendorList = ({ userId, showAlert, showConfirm }) => {
    const [vendors, setVendors] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentVendor, setCurrentVendor] = useState(null);
    const [vendorName, setVendorName] = useState('');
    const [vendorType, setVendorType] = useState('Fotograf');
    const [contactPerson, setContactPerson] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [notes, setNotes] = useState('');

    const vendorsCollectionPath = `artifacts/${appId}/users/${userId}/vendors`;
    const vendorTypes = ['Fotograf', 'Videograf', 'DJ', 'Formație', 'Locație', 'Catering', 'Florărie', 'Cofetărie', 'Make-up Artist', 'Hair Stylist', 'Transport', 'Altele'];
    useEffect(() => { if (!userId) return; const q = query(collection(db, vendorsCollectionPath)); const unsub = onSnapshot(q, (snap) => setVendors(snap.docs.map(d => ({id: d.id, ...d.data()}))), (err) => showAlert(`Eroare furnizori: ${err.message}`, "Eroare")); return () => unsub(); }, [userId, showAlert]);
    const handleAddOrUpdateVendor = async () => { if (!vendorName.trim()) { showAlert("Numele furnizorului este obligatoriu.", "Eroare"); return; } const vendorData = { name: vendorName, type: vendorType, contact: contactPerson, phone, email, notes }; try { if (currentVendor) await updateDoc(doc(db, vendorsCollectionPath, currentVendor.id), vendorData); else await addDoc(collection(db, vendorsCollectionPath), vendorData); closeModal(); } catch (err) { showAlert(`Eroare salvare: ${err.message}`, "Eroare"); } };
    const handleDeleteVendor = (vendorId) => { showConfirm("Sigur ștergi acest furnizor?", "Confirmare", async () => { try { await deleteDoc(doc(db, vendorsCollectionPath, vendorId)); } catch (err) { showAlert(`Eroare ștergere: ${err.message}`, "Eroare"); } }); };
    const openModal = (vendor = null) => { setCurrentVendor(vendor); setVendorName(vendor?.name || ''); setVendorType(vendor?.type || 'Fotograf'); setContactPerson(vendor?.contact || ''); setPhone(vendor?.phone || ''); setEmail(vendor?.email || ''); setNotes(vendor?.notes || ''); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); };
    return (
        <div className="p-6 bg-purple-50 rounded-lg shadow-md">
             <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-semibold text-purple-700">Furnizori</h2><button onClick={() => openModal()} className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center"><PlusCircle size={20} className="mr-2" /> Adaugă Furnizor</button></div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{vendors.map(vendor => (
                <div key={vendor.id} className="bg-white p-4 rounded-lg shadow-sm border border-purple-200"><div className="flex justify-between items-start"><div><h3 className="text-lg font-medium text-purple-800">{vendor.name}</h3><p className="text-sm text-purple-600">{vendor.type}</p>{vendor.contact && <p className="text-xs text-gray-500 mt-1">Contact: {vendor.contact}</p>}{vendor.phone && <p className="text-xs text-gray-500">Telefon: <a href={`tel:${vendor.phone}`} className="hover:underline">{vendor.phone}</a></p>}{vendor.email && <p className="text-xs text-gray-500">Email: <a href={`mailto:${vendor.email}`} className="hover:underline">{vendor.email}</a></p>}{vendor.notes && <p className="text-xs text-gray-500 mt-1">Notițe: {vendor.notes}</p>}</div><div className="flex flex-col space-y-1"><button onClick={() => openModal(vendor)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={18} /></button><button onClick={() => handleDeleteVendor(vendor.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={18} /></button></div></div></div>))}</div>
             <Modal isOpen={isModalOpen} onClose={closeModal} title={currentVendor ? "Modifică Furnizor" : "Adaugă Furnizor Nou"}>{/* ... form ... */}</Modal>
        </div>
    );
};

const SeatingChart = ({ userId, showAlert }) => {
    const [guests, setGuests] = useState([]);
    const [tables, setTables] = useState([]);
    const [newTableName, setNewTableName] = useState("");
    const guestsCollectionPath = `artifacts/${appId}/users/${userId}/guests`;
    const seatingCollectionPath = `artifacts/${appId}/users/${userId}/seating`;

    useEffect(() => {
        if (!userId) return;
        const unsubGuests = onSnapshot(query(collection(db, guestsCollectionPath)), (snap) => setGuests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubSeating = onSnapshot(doc(db, seatingCollectionPath, 'layout'), (docSnap) => { if (docSnap.exists()) setTables(docSnap.data().tables || []); });
        return () => { unsubGuests(); unsubSeating(); };
    }, [userId]);

    const handleAddTable = async () => {
        if (!newTableName.trim()) { showAlert("Numele mesei este obligatoriu.", "Eroare"); return; }
        const updatedTables = [...tables, { id: crypto.randomUUID(), name: newTableName, guests: [] }];
        await setDoc(doc(db, seatingCollectionPath, 'layout'), { tables: updatedTables }, { merge: true });
        setNewTableName("");
    };
    
    const handleDrop = async (e, tableId) => {
        e.preventDefault();
        const guestId = e.dataTransfer.getData("guestId");
        
        let guestToAdd;
        const newTables = tables.map(t => {
            const filteredGuests = t.guests.filter(g => {
                if(g.id === guestId) { guestToAdd = g; return false; }
                return true;
            });
            return {...t, guests: filteredGuests};
        });

        const targetTable = newTables.find(t => t.id === tableId);
        if (targetTable) {
             if(!guestToAdd){ const guestFromList = guests.find(g => g.id === guestId); guestToAdd = guestFromList; }
            if (guestToAdd) targetTable.guests.push(guestToAdd);
        }

        await setDoc(doc(db, seatingCollectionPath, 'layout'), { tables: newTables });
    };

    const handleDragStart = (e, guestId) => e.dataTransfer.setData("guestId", guestId);

    const unassignedGuests = guests.filter(g => !tables.some(t => t.guests.some(guestInTable => guestInTable.id === g.id)));

    return (
        <div className="p-6 bg-indigo-50 rounded-lg shadow-md flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/4 bg-white p-4 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold text-indigo-800 mb-4">Invitați Nealocați ({unassignedGuests.length})</h3>
                <div className="space-y-2 h-96 overflow-y-auto">{unassignedGuests.map(guest => (<div key={guest.id} draggable onDragStart={(e) => handleDragStart(e, guest.id)} className="p-2 bg-indigo-100 rounded cursor-grab">{guest.name}</div>))}</div>
            </div>
            <div className="w-full md:w-3/4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-indigo-700">Aranjarea la Mese</h2>
                    <div className="flex gap-2"><input type="text" value={newTableName} onChange={e => setNewTableName(e.target.value)} placeholder="Nume masă nouă" className="p-2 border rounded-lg"/><button onClick={handleAddTable} className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center"><PlusCircle size={20} className="mr-2"/> Adaugă Masă</button></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {tables.map(table => (<div key={table.id} onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, table.id)} className="bg-white p-4 rounded-lg shadow-lg border-t-4 border-indigo-400 min-h-[150px]"><h4 className="font-bold text-indigo-800 mb-3">{table.name}</h4><div className="space-y-1">{table.guests.map(guest => (<div key={guest.id} draggable onDragStart={(e) => handleDragStart(e, guest.id)} className="p-1.5 bg-gray-100 rounded text-sm cursor-grab">{guest.name}</div>))}</div></div>))}
                </div>
            </div>
        </div>
    );
};


// --- COMPONENTA PRINCIPALĂ APP ---
function App() {
  const [currentView, setCurrentView] = useState('panou');
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [showUserId, setShowUserId] = useState(false); // FIXED: Added missing state
  const { isAlertOpen, alertMessage, alertTitle, showAlert, closeAlert } = useAlertModal();
  const { isConfirmOpen, confirmMessage, confirmTitle, showConfirm, closeConfirm, handleConfirm } = useConfirmModal();

  const [weddingDate, setWeddingDate] = useState(null);
  const [stats, setStats] = useState({ guestsTotal: 0, guestsConfirmed: 0, budgetSpent: 0, tasksTotal: 0, tasksCompleted: 0 });
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [tempWeddingDate, setTempWeddingDate] = useState("");
  
  useEffect(() => {
    const authInstance = getAuth(app);
    const unsubscribe = onAuthStateChanged(authInstance, (user) => { if (user) { setUserId(user.uid); setIsAuthReady(true); } });
    const attemptSignIn = async () => {
        try {
            if (typeof __initial_auth_token === 'string' && __initial_auth_token) { await signInWithCustomToken(authInstance, __initial_auth_token); } 
            else { await signInAnonymously(authInstance); }
        } catch (error) {
            console.error("Auth error, falling back to anonymous", error);
            try { await signInAnonymously(authInstance); } 
            catch (fallbackError) { console.error("Fallback auth error", fallbackError); setAuthError(`Autentificarea a eșuat: ${fallbackError.message}`); setIsAuthReady(true); }
        }
    };
    if (!authInstance.currentUser) { attemptSignIn(); } else { setIsAuthReady(true); }
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const settingsDocRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'main');
    const unsubSettings = onSnapshot(settingsDocRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            setWeddingDate(data.weddingDate);
            setTempWeddingDate(data.weddingDate || "");
        }
    });
    const unsubGuests = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/guests`)), (snap) => { const guests = snap.docs.map(d => d.data()); setStats(s => ({ ...s, guestsTotal: guests.length, guestsConfirmed: guests.filter(g => g.rsvp === 'Confirmat').length })); });
    const unsubBudget = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/budgetItems`)), (snap) => { const items = snap.docs.map(d => d.data()); setStats(s => ({ ...s, budgetSpent: items.reduce((sum, item) => sum + (item.actualCost || 0), 0) })); });
    const unsubTasks = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/tasks`)), (snap) => { const tasks = snap.docs.map(d => d.data()); setStats(s => ({ ...s, tasksTotal: tasks.length, tasksCompleted: tasks.filter(t => t.completed).length })); });
    return () => { unsubSettings(); unsubGuests(); unsubBudget(); unsubTasks(); };
  }, [userId]);

  const handleSaveSettings = async () => {
    if (!userId) return;
    const settingsDocRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'main');
    await setDoc(settingsDocRef, { weddingDate: tempWeddingDate }, { merge: true });
    setIsSettingsModalOpen(false);
    showAlert("Data nunții a fost salvată!", "Succes");
  };

  const renderView = () => {
    if (!isAuthReady || !userId) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-pink-500"></div><p className="ml-4 text-pink-700">Inițializare & Autentificare...</p></div>;
    if (authError) return <div className="text-center p-8 text-red-700 bg-red-100 rounded-lg"><AlertTriangle size={48} className="mx-auto mb-4"/><h2>Eroare de Autentificare</h2><p>{authError}</p></div>;
    const commonProps = { userId, showAlert, showConfirm };
    switch (currentView) {
      case 'panou': return <Dashboard userId={userId} weddingDate={weddingDate} stats={stats} onSettingsClick={() => setIsSettingsModalOpen(true)} />;
      case 'invitati': return <GuestList {...commonProps} />;
      case 'buget': return <Budget {...commonProps} />;
      case 'sarcini': return <TodoList {...commonProps} />;
      case 'furnizori': return <VendorList {...commonProps} />;
      case 'mese': return <SeatingChart {...commonProps} />;
      default: return <Dashboard userId={userId} weddingDate={weddingDate} stats={stats} onSettingsClick={() => setIsSettingsModalOpen(true)} />;
    }
  };

  const NavButton = ({ view, label, icon: Icon }) => (
    <button onClick={() => setCurrentView(view)} className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center sm:justify-start space-y-1 sm:space-y-0 sm:space-x-2 px-3 py-3 text-sm font-medium rounded-md transition-colors duration-150 ${currentView === view ? 'bg-pink-600 text-white shadow-lg' : 'text-pink-100 hover:bg-pink-500'}`}>
      <Icon size={20} /><span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-pink-700 text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">Planificator de Nuntă</h1>
            {userId && (<div className="text-xs flex items-center"><UserCircle2 size={16} className="mr-1"/><span className="cursor-pointer" onClick={() => setShowUserId(!showUserId)}>ID: {showUserId ? userId : `${userId.substring(0,8)}...`}</span></div>)}
        </div>
      </header>
      
      <nav className="bg-pink-500 shadow-md sticky top-0 z-40"><div className="container mx-auto px-2 sm:px-4 py-2"><div className="flex flex-wrap justify-center sm:justify-start space-x-0 sm:space-x-2">
            <NavButton view="panou" label="Panou" icon={LayoutDashboard} />
            <NavButton view="invitati" label="Invitați" icon={Users} />
            <NavButton view="mese" label="Aranjare Mese" icon={Table} />
            <NavButton view="sarcini" label="Sarcini" icon={ListChecks} />
            <NavButton view="buget" label="Buget" icon={DollarSign} />
            <NavButton view="furnizori" label="Furnizori" icon={Briefcase} />
      </div></div></nav>

      <main className="container mx-auto p-4 sm:p-6">{renderView()}</main>

      <footer className="text-center py-6 text-sm text-pink-700"><p>&copy; {new Date().getFullYear()} Planificatorul Tău de Nuntă</p></footer>
      
      <Modal isOpen={isAlertOpen} onClose={closeAlert} title={alertTitle} type={alertTitle.toLowerCase().includes('eroare') ? 'error' : 'default'}><p>{alertMessage}</p><div className="mt-6 flex justify-end"><button onClick={closeAlert} className="px-4 py-2 text-sm font-medium text-white bg-pink-500 hover:bg-pink-600 rounded-md">OK</button></div></Modal>
      <Modal isOpen={isConfirmOpen} onClose={closeConfirm} title={confirmTitle} type="warning"><p>{confirmMessage}</p><div className="mt-6 flex justify-end space-x-3"><button onClick={closeConfirm} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md shadow-sm">Anulează</button><button onClick={handleConfirm} className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow">Confirmă</button></div></Modal>
      <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Setări Nuntă">
        <div><label htmlFor="weddingDate" className="block text-sm font-medium text-gray-700">Data Nunții:</label><input type="date" id="weddingDate" value={tempWeddingDate} onChange={e => setTempWeddingDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"/></div>
        <div className="mt-6 flex justify-end"><button onClick={handleSaveSettings} className="bg-pink-500 text-white font-semibold py-2 px-4 rounded-lg shadow">Salvează Setările</button></div>
      </Modal>
    </div>
  );
}

export default App;
