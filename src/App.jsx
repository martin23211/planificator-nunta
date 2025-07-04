import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, query, addDoc, updateDoc, deleteDoc, setDoc, getDoc, getDocs } from 'firebase/firestore';
import { Users, ListChecks, DollarSign, Briefcase, PlusCircle, Edit2, Trash2, Save, XCircle, CheckCircle, Circle, UserCircle2, AlertTriangle, LayoutDashboard, Table, Settings, CalendarHeart, Flower2, HelpCircle, MailQuestion, Lock, Star, LogOut, LogIn } from 'lucide-react';

// --- CONFIGURARE FIREBASE ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : { apiKey: "DEMO_KEY", authDomain: "DEMO.firebaseapp.com", projectId: "DEMO" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'planificator-nunta-app';

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


// --- DATE PREDEFINITE (NOUA STRUCTURĂ) ---
const newDefaultTasks = {
  "12+ Luni Înainte": {
    "Planificare Inițială": [
      { name: "Anunțați logodna familiei și prietenilor.", description: "Împărtășiți vestea cea mare cu cei dragi." },
      { name: "Stabiliți o viziune pentru nuntă (stil, formalitate, număr de invitați).", description: "Discutați despre cum vă imaginați ziua nunții: elegantă, rustică, restrânsă, etc." },
      { name: "Alegeți o dată aproximativă pentru nuntă.", description: "Luați în considerare anotimpul, disponibilitatea persoanelor cheie și eventualele sărbători." }
    ],
    "Buget": [
      { name: "Stabiliți bugetul total al nunții.", description: "Analizați finanțele și decideți o sumă totală realistă pe care sunteți dispuși să o cheltuiți." },
      { name: "Creați o foaie de calcul pentru a urmări cheltuielile.", description: "Folosiți secțiunea Buget a aplicației pentru a ține evidența fiecărui cost." },
      { name: "Decideți cine contribuie financiar și cu ce sume.", description: "Discuție deschisă cu părinții sau alte persoane implicate, dacă este cazul." }
    ],
    "Invitați": [
      { name: "Creați o listă preliminară de invitați.", description: "Faceți o listă inițială cu toți cei pe care ați dori să-i aveți alături." }
    ],
    "Echipa de Nuntă": [
      { name: "Alegeți nașii.", description: "Selectați persoanele care vă vor fi alături și vă vor ghida în acest proces." },
      { name: "Alegeți domnișoarele și cavalerii de onoare.", description: "Invitați prietenii apropiați să facă parte din alaiul vostru." }
    ]
  },
  "10-12 Luni": {
    "Locație & Biserică": [
      { name: "Vizitați și rezervați locația pentru recepție.", description: "Asigurați-vă că semnați un contract clar care specifică toate detaliile." },
      { name: "Rezervați biserica pentru ceremonia religioasă.", description: "Discutați cu preotul și stabiliți data și ora exactă." }
    ],
    "Furnizori Cheie": [
      { name: "Angajați un wedding planner (opțional).", description: "Dacă bugetul permite, un planner vă poate economisi timp și stres." },
      { name: "Rezervați fotograful și videograful.", description: "Analizați portofolii și alegeți stilul care vi se potrivește. Semnați contracte." },
      { name: "Rezervați formația sau DJ-ul.", description: "Asigurați-vă că ați ascultat câteva mostre și că repertoriul corespunde preferințelor voastre." }
    ]
  },
  "8-10 Luni": {
    "Ținute & Verighete": [
      { name: "Începeți căutarea rochiei de mireasă.", description: "Probați diverse stiluri pentru a vedea ce vi se potrivește cel mai bine." },
      { name: "Alegeți și comandați verighetele.", description: "Luați în considerare gravarea acestora cu un mesaj personal." }
    ],
    "Invitați & Save the Date": [
      { name: "Trimiteți cardurile “Save the Date” (opțional).", description: "Este un gest util, în special pentru invitații care vin din alte localități." }
    ]
  },
  "6-8 Luni": {
    "Furnizori Secundari": [
      { name: "Rezervați floristul și decoratorul.", description: "Discutați despre tema nunții, culori și aranjamentele florale dorite." },
      { name: "Contactați firme de catering (dacă locația nu oferă).", description: "Stabiliți meniuri de degustare." }
    ],
    "Planificare Lună de Miere": [
      { name: "Planificați și rezervați luna de miere.", description: "Profitați de oferte și asigurați-vă că aveți toate documentele de călătorie în regulă." }
    ]
  },
  "4-6 Luni": {
    "Ținute & Accesorii": [
      { name: "Comandați rochia de mireasă și costumul de mire.", description: "Asigurați-vă că ați luat în calcul timpul necesar pentru ajustări." },
      { name: "Alegeți ținutele pentru domnișoarele de onoare.", description: "Coordonați stilul și culorile cu tema generală a nunții." }
    ],
    "Detalii Eveniment": [
      { name: "Stabiliți meniul final și faceți degustarea.", description: "Alegeți preparatele finale împreună cu reprezentantul locației sau al firmei de catering." },
      { name: "Comandați tortul de nuntă și candy bar-ul.", description: "Faceți o degustare pentru a alege aromele preferate." },
      { name: "Înscrieți-vă la cursuri de dans (opțional).", description: "Pregătiți dansul mirilor pentru a impresiona invitații." }
    ]
  },
  "3-4 Luni": {
    "Invitații & Papetărie": [
      { name: "Finalizați lista de invitați.", description: "Treceți prin lista preliminară și stabiliți versiunea finală." },
      { name: "Comandați invitațiile și restul papetăriei (meniuri, place carduri).", description: "Verificați textul cu atenție înainte de a trimite la tipar." }
    ],
    "Logistică": [
      { name: "Rezervați transport pentru voi și pentru invitați (dacă este cazul).", description: "Luați în considerare o mașină de epocă, o limuzină sau un microbuz pentru invitați." }
    ]
  },
  "2 Luni": {
    "Documente & Legal": [
      { name: "Verificați valabilitatea actelor de identitate.", description: "Asigurați-vă că nu expiră în preajma nunții." },
      { name: "Interesați-vă de actele necesare pentru cununia civilă.", description: "Faceți o listă cu tot ce trebuie pregătit: certificate de naștere, etc." }
    ],
    "Detalii Finale": [
      { name: "Trimiteți invitațiile.", description: "Ideal, cu 6-8 săptămâni înainte de eveniment." },
      { name: "Cumpărați toate accesoriile pentru ținute.", description: "Pantofi, bijuterii, voal, butoni, etc." },
      { name: "Faceți programare pentru probele de coafură și machiaj.", description: "Mergeți cu poze de inspirație pentru a obține look-ul dorit." }
    ]
  },
  "1 Lună": {
    "Confirmări & Plăți": [
      { name: "Contactați invitații care nu au răspuns la invitație.", description: "Sunați pentru a obține un număr cât mai exact de participanți." },
      { name: "Stabiliți o întâlnire finală cu fotograful/videograful.", description: "Discutați despre momentele cheie pe care doriți să le surprindă." },
      { name: "Stabiliți playlist-ul final cu DJ-ul/formația.", description: "Includeți melodiile preferate și menționați ce stiluri muzicale doriți să predomine." }
    ],
    "Legal": [
      { name: "Aplicați pentru certificatul prenupțial.", description: "Acesta este necesar pentru cununia civilă și are o valabilitate limitată." }
    ]
  },
  "1-2 Săptămâni": {
    "Finalizarea Detaliilor": [
      { name: "Comunicați numărul final de invitați la restaurant.", description: "Acesta este momentul în care stabiliți numărul final de meniuri." },
      { name: "Realizați planul final al meselor (seating chart).", description: "Folosiți secțiunea 'Aranjare Mese' din aplicație pentru a organiza totul vizual." },
      { name: "Confirmați toate detaliile cu furnizorii.", description: "Ora sosirii, programul, plățile finale etc." },
      { name: "Faceți proba finală pentru rochia de mireasă și costumul de mire.", description: "Asigurați-vă că totul se potrivește perfect." }
    ],
    "Pregătiri Personale": [
      { name: "Pregătiți plicurile cu banii pentru furnizori.", description: "Organizați plățile pentru a le avea la îndemână în ziua nunții." },
      { name: "Faceți bagajul pentru luna de miere.", description: "Nu lăsați pe ultima sută de metri." }
    ]
  },
  "Ziua de Dinaintea Nunții": {
    "Relaxare & Verificare": [
      { name: "Mergeți la salon pentru manichiură și pedichiură.", description: "Un moment de răsfăț bine meritat." },
      { name: "Verificați dacă toate ținutele și accesoriile sunt pregătite.", description: "Puneți totul deoparte pentru a evita stresul de dimineață." },
      { name: "Delegați sarcini de ultim moment nașilor sau prietenilor.", description: "Nu încercați să faceți totul singuri." },
      { name: "Relaxați-vă și odihniți-vă!", description: "Încercați să aveți o seară liniștită și să dormiți bine." }
    ]
  }
};

// --- COMPONENTE ---

const PremiumFeatureBlocker = ({ onUpgrade }) => (
    <div className="relative p-6 bg-gray-100 rounded-lg shadow-inner text-center flex flex-col items-center justify-center h-full">
        <div className="absolute inset-0 bg-gray-200 opacity-70 backdrop-blur-sm"></div>
        <div className="relative z-10">
            <Star className="mx-auto h-12 w-12 text-yellow-500" />
            <h3 className="mt-2 text-xl font-semibold text-gray-800">Funcționalitate Premium</h3>
            <p className="mt-1 text-sm text-gray-600">Perioada de probă a expirat. Pentru a accesa această secțiune, te rugăm să activezi abonamentul.</p>
            <button
                onClick={onUpgrade}
                className="mt-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105"
            >
                Activează Premium
            </button>
        </div>
    </div>
);

const Dashboard = ({ userId, weddingDate, stats, onSettingsClick }) => {
    const [countdown, setCountdown] = useState({});
    useEffect(() => {
        if (!weddingDate) return;
        const interval = setInterval(() => {
            const now = new Date();
            const wedding = new Date(weddingDate);
            const diff = wedding - now;
            if (diff <= 0) { setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 }); clearInterval(interval); return; }
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
            <div><p className="text-2xl font-bold text-gray-800">{value}</p><p className="text-sm font-medium text-gray-500">{label}</p></div>
        </div>
    );
    return (
        <div className="p-6 bg-gray-50 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-700 flex items-center"><CalendarHeart className="mr-3 text-pink-500"/> Panou de Bord</h2>
                <button onClick={onSettingsClick} className="text-gray-500 hover:text-pink-600 p-2 rounded-full hover:bg-pink-100 transition"><Settings size={24} /></button>
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
  useEffect(() => { if (!userId) return; const q = query(collection(db, guestsCollectionPath)); const unsubscribe = onSnapshot(q, (snap) => setGuests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))), (error) => showAlert(`Eroare invitați: ${error.message}`, "Eroare")); return () => unsubscribe(); }, [userId, showAlert]);
  const handleAddOrUpdateGuest = async () => { if (!newGuestName.trim()) { showAlert("Numele este obligatoriu.", "Eroare"); return; } const guestData = { name: newGuestName, rsvp: newGuestRsvp, notes: newGuestNotes }; try { if (currentGuest) { await updateDoc(doc(db, guestsCollectionPath, currentGuest.id), guestData); } else { await addDoc(collection(db, guestsCollectionPath), guestData); } closeModal(); } catch (error) { showAlert(`Eroare salvare: ${error.message}`, "Eroare"); } };
  const handleDeleteGuest = (guestId) => { showConfirm("Sigur ștergi acest invitat?", "Confirmare", async () => { try { await deleteDoc(doc(db, guestsCollectionPath, guestId)); } catch (error) { showAlert(`Eroare ștergere: ${error.message}`, "Eroare"); } }); };
  const openModal = (guest = null) => { setCurrentGuest(guest); setNewGuestName(guest?.name || ''); setNewGuestRsvp(guest?.rsvp || 'Așteaptă'); setNewGuestNotes(guest?.notes || ''); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); };
  const filteredGuests = guests.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const RsvpIcon = ({ status }) => {
    switch (status) {
        case 'Confirmat': return <CheckCircle className="text-green-500" size={20} />;
        case 'Refuzat': return <XCircle className="text-red-500" size={20} />;
        case 'Poate': return <MailQuestion className="text-blue-500" size={20} />;
        case 'Așteaptă': default: return <HelpCircle className="text-yellow-500" size={20} />;
    }
  };
  return (
    <div className="p-6 bg-pink-50 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-semibold text-pink-700">Listă Invitați</h2><button onClick={() => openModal()} className="bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center transition"><PlusCircle size={20} className="mr-2" /> Adaugă Invitat</button></div>
      <input type="text" placeholder="Caută invitat..." className="w-full p-2 mb-4 border border-pink-300 rounded-lg focus:ring-pink-500 focus:border-pink-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      {filteredGuests.length === 0 && <p className="text-gray-600">Niciun invitat găsit.</p>}
      <div className="space-y-4">{filteredGuests.map(guest => ( <div key={guest.id} className="bg-white p-4 rounded-lg shadow-sm border border-pink-200 flex justify-between items-start"><div><h3 className="text-lg font-medium text-pink-800">{guest.name}</h3><div className="flex items-center mt-1"><RsvpIcon status={guest.rsvp} /><p className="text-sm ml-2">{guest.rsvp}</p></div>{guest.notes && <p className="text-xs text-gray-500 mt-2 italic">Notițe: {guest.notes}</p>}</div><div className="flex space-x-2"><button onClick={() => openModal(guest)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={18} /></button><button onClick={() => handleDeleteGuest(guest.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={18} /></button></div></div> ))}</div>
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

const Budget = ({ userId, showAlert, showConfirm, isPremium, onUpgrade }) => {
    const [items, setItems] = useState([]);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [itemName, setItemName] = useState('');
    const [category, setCategory] = useState('Locație');
    const [estimatedCost, setEstimatedCost] = useState('');
    const [actualCost, setActualCost] = useState('');
    const [isPaid, setIsPaid] = useState(false);
    
    const [totalBudget, setTotalBudget] = useState(0);
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    const [tempTotalBudget, setTempTotalBudget] = useState("");

    const budgetCollectionPath = `artifacts/${appId}/users/${userId}/budgetItems`;
    const settingsDocRef = doc(db, `users/${userId}/settings`, 'main');
    const categories = ['Locație', 'Mâncare & Băutură', 'Fotograf/Videograf', 'Muzică/DJ', 'Ținute', 'Decorațiuni', 'Invitații', 'Verighete', 'Transport', 'Diverse'];
    
    const budgetAllocation = {
        'Locație': 0.25, 'Mâncare & Băutură': 0.25, 'Fotograf/Videograf': 0.10, 'Muzică/DJ': 0.08,
        'Ținute': 0.12, 'Decorațiuni': 0.07, 'Invitații': 0.03, 'Verighete': 0.03, 'Diverse': 0.07, 'Transport': 0.00,
    };

    useEffect(() => {
        if (!userId) return;
        const unsubSettings = onSnapshot(settingsDocRef, (doc) => {
            if (doc.exists() && doc.data().totalBudget) {
                const budget = doc.data().totalBudget;
                setTotalBudget(budget);
                setTempTotalBudget(budget.toString());
            }
        });
        const unsubItems = onSnapshot(query(collection(db, budgetCollectionPath)), (snap) => setItems(snap.docs.map(d => ({id: d.id, ...d.data()}))), (err) => showAlert(`Eroare buget: ${err.message}`, "Eroare"));
        return () => { unsubSettings(); unsubItems(); };
    }, [userId, showAlert]);

    const handleSaveTotalBudget = async () => {
        const newTotal = parseFloat(tempTotalBudget);
        if (isNaN(newTotal) || newTotal < 0) { showAlert("Vă rugăm introduceți o sumă validă.", "Eroare"); return; }
        await setDoc(settingsDocRef, { totalBudget: newTotal }, { merge: true });
        setIsBudgetModalOpen(false);
        showAlert("Bugetul total a fost salvat!", "Succes");
    };
    
    const handleAddOrUpdateItem = async () => { if (!itemName.trim() || !estimatedCost.trim()) { showAlert("Numele și costul estimat sunt obligatorii.", "Validare Eșuată"); return; } const itemData = { name: itemName, category, estimatedCost: parseFloat(estimatedCost) || 0, actualCost: actualCost ? (parseFloat(actualCost) || 0) : 0, paid: isPaid }; try { if (currentItem) await updateDoc(doc(db, budgetCollectionPath, currentItem.id), itemData); else await addDoc(collection(db, budgetCollectionPath), itemData); closeItemModal(); } catch (err) { showAlert(`Eroare salvare: ${err.message}`, "Eroare"); } };
    const handleDeleteItem = (itemId) => { showConfirm("Sigur ștergi această cheltuială?", "Confirmare", async () => { try { await deleteDoc(doc(db, budgetCollectionPath, itemId)); } catch (err) { showAlert(`Eroare ștergere: ${err.message}`, "Eroare"); } }); };
    const togglePaidStatus = async (item) => { try { await updateDoc(doc(db, budgetCollectionPath, item.id), { paid: !item.paid }); } catch (err) { showAlert(`Eroare actualizare: ${err.message}`, "Eroare"); } };
    const openItemModal = (item = null) => { setCurrentItem(item); setItemName(item?.name || ''); setCategory(item?.category || 'Locație'); setEstimatedCost(item?.estimatedCost?.toString() || ''); setActualCost(item?.actualCost?.toString() || ''); setIsPaid(item?.paid || false); setIsItemModalOpen(true); };
    const closeItemModal = () => { setIsItemModalOpen(false); };
    
    const spentPerCategory = items.reduce((acc, item) => {
        const cost = Number(item.actualCost) || 0;
        if (!acc[item.category]) { acc[item.category] = 0; }
        acc[item.category] += cost;
        return acc;
    }, {});

    const totalEstimated = items.reduce((s, i) => s + (Number(i.estimatedCost) || 0), 0);
    const totalActual = items.reduce((s, i) => s + (Number(i.actualCost) || 0), 0);
    const totalPaid = items.filter(i => i.paid).reduce((s, i) => s + (Number(i.actualCost) || 0), 0);

    return (
        <div className="p-6 bg-green-50 rounded-lg shadow-md space-y-8">
            {/* Planner Section */}
            <div className="p-6 bg-white rounded-lg shadow relative">
                {!isPremium && <PremiumFeatureBlocker onUpgrade={onUpgrade} />}
                <div className={!isPremium ? 'blur-sm pointer-events-none' : ''}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-green-800">Planificator Buget</h3>
                        <button onClick={() => setIsBudgetModalOpen(true)} className="bg-green-200 text-green-800 hover:bg-green-300 font-semibold py-2 px-4 rounded-lg text-sm">Setează Bugetul Total</button>
                    </div>
                    {totalBudget > 0 ? (
                        <div>
                            <p className="text-center text-gray-600 mb-4">Buget total propus: <span className="font-bold text-lg">{totalBudget.toFixed(2)} RON</span></p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(budgetAllocation).map(([category, percentage]) => {
                                    const suggested = totalBudget * percentage;
                                    const spent = spentPerCategory[category] || 0;
                                    const difference = suggested - spent;
                                    const progress = suggested > 0 ? (spent / suggested) * 100 : 0;
                                    return (
                                        <div key={category} className="p-4 border rounded-lg bg-gray-50">
                                            <h4 className="font-bold text-gray-700">{category}</h4>
                                            <p className="text-xs text-gray-500">Sugerăm: {suggested.toFixed(2)} RON ({(percentage * 100).toFixed(0)}%)</p>
                                            <p className="text-sm font-semibold">Cheltuit: {spent.toFixed(2)} RON</p>
                                            <div className="w-full bg-gray-200 rounded-full h-2.5 my-2"><div className={`h-2.5 rounded-full ${progress > 100 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(progress, 100)}%` }}></div></div>
                                            <p className={`text-xs font-medium ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>{difference >= 0 ? `Rămas: ${difference.toFixed(2)} RON` : `Depășit: ${Math.abs(difference).toFixed(2)} RON`}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (<p className="text-center text-gray-500">Setați un buget total pentru a vedea sugestiile de alocare a cheltuielilor.</p>)}
                </div>
            </div>

            {/* Tracker Section */}
            <div>
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-semibold text-green-700">Urmărire Cheltuieli</h2><button onClick={() => openItemModal()} className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center"><PlusCircle size={20} className="mr-2" /> Adaugă Cheltuială</button></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-white rounded-lg shadow border-l-4 border-green-300"><h4 className="text-sm font-medium text-gray-500">Total Estimat</h4><p className="text-2xl font-bold text-green-700">{totalEstimated.toFixed(2)} RON</p></div>
                    <div className="p-4 bg-white rounded-lg shadow border-l-4 border-green-400"><h4 className="text-sm font-medium text-gray-500">Total Cheltuit (Actual)</h4><p className="text-2xl font-bold text-green-700">{totalActual.toFixed(2)} RON</p></div>
                    <div className="p-4 bg-white rounded-lg shadow border-l-4 border-green-500"><h4 className="text-sm font-medium text-gray-500">Total Plătit</h4><p className="text-2xl font-bold text-green-700">{totalPaid.toFixed(2)} RON</p></div>
                </div>
                <div className="space-y-4">{items.map((item) => (<div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-green-200"><div className="flex justify-between items-start"><div><h3 className="text-lg font-medium text-green-800">{item.name} <span className="text-xs text-gray-500">({item.category})</span></h3><p className="text-sm text-gray-600">Estimat: {(item.estimatedCost || 0).toFixed(2)} RON</p>{item.actualCost > 0 && <p className="text-sm text-gray-600">Actual: {(item.actualCost || 0).toFixed(2)} RON</p>}</div><div className="flex items-center space-x-3"><button onClick={() => togglePaidStatus(item)} className={`p-1 rounded-full ${item.paid ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`} title={item.paid ? "Marchează ca neplătit" : "Marchează ca plătit"}>{item.paid ? <CheckCircle size={18} /> : <Circle size={18} />}</button><button onClick={() => openItemModal(item)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={18} /></button><button onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={18} /></button></div></div></div>))}</div>
            </div>

            <Modal isOpen={isBudgetModalOpen} onClose={() => setIsBudgetModalOpen(false)} title="Setează Bugetul Total">
                <div><label htmlFor="totalBudget" className="block text-sm font-medium text-gray-700">Buget Total (RON)</label><input type="number" id="totalBudget" value={tempTotalBudget} onChange={(e) => setTempTotalBudget(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Ex: 50000"/></div>
                <div className="mt-6 flex justify-end"><button onClick={handleSaveTotalBudget} className="bg-green-500 text-white font-semibold py-2 px-4 rounded-lg shadow">Salvează Bugetul</button></div>
            </Modal>
            <Modal isOpen={isItemModalOpen} onClose={closeItemModal} title={currentItem ? "Modifică Cheltuială" : "Adaugă Cheltuială Nouă"}>
                <div className="space-y-4">
                    <div><label htmlFor="itemName" className="block text-sm font-medium text-gray-700">Nume Element:</label><input type="text" id="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Ex: Rochie mireasă"/></div>
                    <div><label htmlFor="category" className="block text-sm font-medium text-gray-700">Categorie:</label><select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">{categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                    <div><label htmlFor="estimatedCost" className="block text-sm font-medium text-gray-700">Cost Estimat (RON):</label><input type="number" id="estimatedCost" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Ex: 5000"/></div>
                    <div><label htmlFor="actualCost" className="block text-sm font-medium text-gray-700">Cost Actual (RON, opțional):</label><input type="number" id="actualCost" value={actualCost} onChange={(e) => setActualCost(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Ex: 4850"/></div>
                    <div className="flex items-center"><input id="isPaid" type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"/><label htmlFor="isPaid" className="ml-2 block text-sm text-gray-900">Plătit</label></div>
                    <div className="flex justify-end space-x-3"><button onClick={closeItemModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md">Anulează</button><button onClick={handleAddOrUpdateItem} className="px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-md flex items-center"><Save size={16} className="mr-2" /> Salvează</button></div>
                </div>
            </Modal>
        </div>
    );
};

const TodoList = ({ userId, showAlert, showConfirm }) => {
    const [tasks, setTasks] = useState([]);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [newTaskName, setNewTaskName] = useState("");
    const [newTaskTimeline, setNewTaskTimeline] = useState(Object.keys(newDefaultTasks)[0]);
    const [newTaskCategory, setNewTaskCategory] = useState(Object.keys(newDefaultTasks[Object.keys(newDefaultTasks)[0]])[0]);
    
    const tasksCollectionPath = `artifacts/${appId}/users/${userId}/tasks`;
    const allCategories = [...new Set(Object.values(newDefaultTasks).flatMap(timeline => Object.keys(timeline)))];

    useEffect(() => {
        if (!userId) return;
        const q = query(collection(db, tasksCollectionPath));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const tasksFromDb = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTasks(tasksFromDb);
        }, (error) => showAlert(`Eroare la încărcarea sarcinilor: ${error.message}`, "Eroare"));
        return () => unsubscribe();
    }, [userId, showAlert]);
    
    const addDefaultTasks = () => {
        showConfirm("Vrei să adaugi lista standard de sarcini? Asta va adăuga sarcini organizate pe etapele de planificare.", "Adaugă Sarcini Standard", async () => {
            try {
                const existingTasksSnapshot = await getDocs(query(collection(db, tasksCollectionPath)));
                const existingTaskNames = new Set(existingTasksSnapshot.docs.map(d => d.data().name));
                let addedCount = 0;
                for (const timeline in newDefaultTasks) {
                    for (const category in newDefaultTasks[timeline]) {
                        for (const task of newDefaultTasks[timeline][category]) {
                            if (!existingTaskNames.has(task.name)) {
                                await addDoc(collection(db, tasksCollectionPath), { 
                                    name: task.name, 
                                    description: task.description,
                                    category: category,
                                    timeline: timeline,
                                    completed: false 
                                });
                                addedCount++;
                            }
                        }
                    }
                }
                showAlert(`${addedCount} sarcini noi au fost adăugate!`, "Succes");
            } catch (error) { showAlert(`Eroare la adăugarea sarcinilor: ${error.message}`, "Eroare"); }
        });
    };

    const handleAddManualTask = async () => {
        if (!newTaskName.trim()) { showAlert("Numele sarcinii este obligatoriu.", "Eroare"); return; }
        try {
            await addDoc(collection(db, tasksCollectionPath), { 
                name: newTaskName, 
                description: "",
                category: newTaskCategory, 
                timeline: newTaskTimeline, 
                completed: false 
            });
            showAlert("Sarcină adăugată!", "Succes");
            setIsTaskModalOpen(false);
            setNewTaskName("");
        } catch (error) { showAlert(`Eroare la adăugarea sarcinii: ${error.message}`, "Eroare"); }
    };

    const toggleCompleteTask = async (task) => {
        try { await updateDoc(doc(db, tasksCollectionPath, task.id), { completed: !task.completed }); } catch (error) { showAlert(`Eroare la actualizarea sarcinii: ${error.message}`, "Eroare"); }
    };

    const groupedTasks = tasks.reduce((acc, task) => {
        const { timeline, category } = task;
        if (!acc[timeline]) acc[timeline] = {};
        if (!acc[timeline][category]) acc[timeline][category] = [];
        acc[timeline][category].push(task);
        return acc;
    }, {});

    const timelineOrder = Object.keys(newDefaultTasks);

    const CategorySection = ({ title, tasksInCategory }) => {
        const [isOpen, setIsOpen] = useState(true);
        if (!tasksInCategory || tasksInCategory.length === 0) return null;
        const completedCount = tasksInCategory.filter(t => t.completed).length;
        const totalCount = tasksInCategory.length;
        const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
        return (
            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
                <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                    <h3 className="text-lg font-semibold text-blue-800">{title}</h3>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-500">{completedCount}/{totalCount}</span>
                        <div className="w-24 bg-gray-200 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div></div>
                        <XCircle size={20} className={`transform transition-transform ${isOpen ? 'rotate-45 text-blue-600' : 'text-gray-400'}`} />
                    </div>
                </div>
                {isOpen && <div className="mt-4 space-y-3">
                    {tasksInCategory.sort((a,b) => a.name.localeCompare(b.name)).map(task => (
                        <div key={task.id} className="flex items-start">
                            <button onClick={() => toggleCompleteTask(task)} className={`mr-3 mt-1 p-1 rounded-full flex-shrink-0 ${task.completed ? 'text-green-500' : 'text-gray-400 hover:text-blue-500'}`}>{task.completed ? <CheckCircle size={22} /> : <Circle size={22} />}</button>
                            <div>
                                <span className={task.completed ? 'line-through text-gray-500' : 'text-gray-700'}>{task.name}</span>
                                {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
                            </div>
                        </div>
                    ))}
                </div>}
            </div>
        )
    };
    
    return (
        <div className="p-6 bg-blue-50 rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-blue-700">Listă de Sarcini</h2>
                <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => setIsTaskModalOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center justify-center transition"><PlusCircle size={20} className="mr-2" /> Adaugă Sarcină Manuală</button>
                    <button onClick={addDefaultTasks} className="bg-yellow-400 hover:bg-yellow-500 text-yellow-800 font-semibold py-2 px-4 rounded-lg shadow flex items-center justify-center transition"><ListChecks size={20} className="mr-2" /> Adaugă Sarcini Standard</button>
                </div>
            </div>
            <div className="space-y-6">
                {timelineOrder.map(timeline => {
                    if (!groupedTasks[timeline]) return null;
                    return (
                        <div key={timeline}>
                            <h2 className="text-2xl font-bold text-gray-700 mb-4 pb-2 border-b-2 border-blue-200">{timeline}</h2>
                            <div className="space-y-4">
                                {Object.keys(groupedTasks[timeline]).sort().map(category => (
                                    <CategorySection
                                        key={category}
                                        title={category}
                                        tasksInCategory={groupedTasks[timeline][category]}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
            <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="Adaugă Sarcină Manuală">
                <div className="space-y-4">
                    <div><label htmlFor="taskName" className="block text-sm font-medium text-gray-700">Nume Sarcină:</label><input type="text" id="taskName" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Ex: Confirmă florile"/></div>
                    <div><label htmlFor="taskTimeline" className="block text-sm font-medium text-gray-700">Perioada:</label><select id="taskTimeline" value={newTaskTimeline} onChange={(e) => setNewTaskTimeline(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">{timelineOrder.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div><label htmlFor="taskCategory" className="block text-sm font-medium text-gray-700">Categorie:</label><select id="taskCategory" value={newTaskCategory} onChange={(e) => setNewTaskCategory(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">{allCategories.sort().map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                    <div className="flex justify-end"><button onClick={handleAddManualTask} className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md flex items-center"><Save size={16} className="mr-2" /> Salvează</button></div>
                </div>
            </Modal>
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
             <Modal isOpen={isModalOpen} onClose={closeModal} title={currentVendor ? "Modifică Furnizor" : "Adaugă Furnizor Nou"}>
                <div className="space-y-3">
                    <div><label htmlFor="vendorName" className="block text-sm font-medium text-gray-700">Nume Furnizor:</label><input type="text" id="vendorName" value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Ex: Foto Magic"/></div>
                    <div><label htmlFor="vendorType" className="block text-sm font-medium text-gray-700">Tip Furnizor:</label><select id="vendorType" value={vendorType} onChange={(e) => setVendorType(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">{vendorTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></div>
                    <div><label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700">Persoană Contact:</label><input type="text" id="contactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Ex: Ana Popescu"/></div>
                    <div><label htmlFor="phone" className="block text-sm font-medium text-gray-700">Telefon:</label><input type="tel" id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Ex: 0722123456"/></div>
                    <div><label htmlFor="email" className="block text-sm font-medium text-gray-700">Email:</label><input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Ex: contact@fotomagic.ro"/></div>
                    <div><label htmlFor="vendorNotes" className="block text-sm font-medium text-gray-700">Notițe:</label><textarea id="vendorNotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows="2" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Ex: Pachet premium"></textarea></div>
                    <div className="flex justify-end space-x-3"><button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md">Anulează</button><button onClick={handleAddOrUpdateVendor} className="px-4 py-2 text-sm font-medium text-white bg-purple-500 rounded-md flex items-center"><Save size={16} className="mr-2" /> Salvează</button></div>
                </div>
             </Modal>
        </div>
    );
};

const SeatingChart = ({ userId, showAlert, isPremium, onUpgrade }) => {
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

    if (!isPremium) {
        return (
            <div className="p-6 bg-indigo-50 rounded-lg shadow-md h-full">
                <PremiumFeatureBlocker onUpgrade={onUpgrade} />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 bg-indigo-50 rounded-lg shadow-md flex flex-row gap-4">
            <div className="w-2/5 md:w-1/3 bg-white p-2 md:p-4 rounded-lg shadow-inner flex flex-col min-w-0">
                <h3 className="text-base md:text-lg font-semibold text-indigo-800 mb-4 sticky top-0 bg-white pb-2 z-10">Invitați Nealocați ({unassignedGuests.length})</h3>
                <div className="space-y-2 overflow-y-auto">
                    {unassignedGuests.map(guest => (
                        <div key={guest.id} draggable onDragStart={(e) => handleDragStart(e, guest.id)} className="p-2 text-sm bg-indigo-100 rounded cursor-grab shadow-sm hover:shadow-md transition-shadow truncate">
                            {guest.name}
                        </div>
                    ))}
                </div>
            </div>
            <div className="w-3/5 md:w-2/3 min-w-0">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <h2 className="text-xl md:text-2xl font-semibold text-indigo-700">Aranjarea la Mese</h2>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <input type="text" value={newTableName} onChange={e => setNewTableName(e.target.value)} placeholder="Nume masă" className="p-2 border rounded-lg w-full sm:w-auto"/>
                        <button onClick={handleAddTable} className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center justify-center"><PlusCircle size={20} className="mr-2"/> Adaugă</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {tables.map(table => (
                        <div key={table.id} onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, table.id)} 
                             className="bg-white p-4 rounded-lg shadow-lg border-t-4 border-indigo-400 min-h-[200px]">
                            <h4 className="font-bold text-indigo-800 mb-3 text-center border-b pb-2 truncate">{table.name}</h4>
                            <div className="space-y-2">
                                {table.guests.map(guest => (
                                    <div key={guest.id} draggable onDragStart={(e) => handleDragStart(e, guest.id)} 
                                         className="p-1.5 bg-gray-100 rounded text-sm cursor-grab truncate">
                                         {guest.name}
                                    </div>
                                ))}
                                {table.guests.length === 0 && <p className="text-xs text-center text-gray-400 pt-8">Trage un invitat aici</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const LoginPage = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await onLogin(email, password);
        } catch (err) {
            setError("Email sau parolă incorectă. Vă rugăm încercați din nou.");
            console.error("Login error:", err);
        }
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-200 via-purple-100 to-indigo-200">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-2xl">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-bold text-gray-900 font-serif-display">Bine ai revenit!</h2>
                    <p className="mt-2 text-sm text-gray-600">Autentifică-te pentru a continua planificarea.</p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="email-address" className="sr-only">Adresă de e-mail</label>
                            <input id="email-address" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-pink-500 focus:border-pink-500 focus:z-10 sm:text-sm"
                                placeholder="Adresă de e-mail" />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Parolă</label>
                            <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-pink-500 focus:border-pink-500 focus:z-10 sm:text-sm"
                                placeholder="Parolă" />
                        </div>
                    </div>
                    {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                    <div>
                        <button type="submit" disabled={loading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:bg-pink-300">
                            {loading ? 'Se încarcă...' : 'Autentificare'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// Componenta principală APP, acum cu logică de autentificare
function App() {
  const [currentView, setCurrentView] = useState('panou');
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const { isAlertOpen, alertMessage, alertTitle, showAlert, closeAlert } = useAlertModal();
  const { isConfirmOpen, confirmMessage, confirmTitle, showConfirm, closeConfirm, handleConfirm } = useConfirmModal();
  const [weddingDate, setWeddingDate] = useState(null);
  const [stats, setStats] = useState({ guestsTotal: 0, guestsConfirmed: 0, budgetSpent: 0, tasksTotal: 0, tasksCompleted: 0 });
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [tempWeddingDate, setTempWeddingDate] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setUser(user);
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const unsubSettings = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const status = data.subscriptionStatus;
                    setSubscriptionStatus(status);
                    setIsPremium(status === 'trialing' || status === 'active');
                } else {
                    setIsPremium(false);
                }
            });

            const unsubGuests = onSnapshot(query(collection(db, `artifacts/${appId}/users/${user.uid}/guests`)), (snap) => setStats(s => ({ ...s, guestsTotal: snap.docs.length, guestsConfirmed: snap.docs.filter(d => d.data().rsvp === 'Confirmat').length })));
            const unsubBudget = onSnapshot(query(collection(db, `artifacts/${appId}/users/${user.uid}/budgetItems`)), (snap) => setStats(s => ({ ...s, budgetSpent: snap.docs.reduce((sum, doc) => sum + (doc.data().actualCost || 0), 0) })));
            const unsubTasks = onSnapshot(query(collection(db, `artifacts/${appId}/users/${user.uid}/tasks`)), (snap) => setStats(s => ({ ...s, tasksTotal: snap.docs.length, tasksCompleted: snap.docs.filter(d => d.data().completed).length })));
            const unsubWeddingDate = onSnapshot(doc(db, `artifacts/${appId}/users/${user.uid}/settings`, 'main'), (doc) => { if (doc.exists()) { const data = doc.data(); setWeddingDate(data.weddingDate); setTempWeddingDate(data.weddingDate || ""); } });
            
            return () => { unsubSettings(); unsubGuests(); unsubBudget(); unsubTasks(); unsubWeddingDate(); };
        }
        setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };
  
  const handleUpgrade = () => {
      setIsUpgradeModalOpen(false);
      showAlert("Vei fi redirecționat către pagina de plată pentru a activa abonamentul.");
  };

  const handleNavClick = (view) => {
      const premiumViews = ['mese'];
      if (premiumViews.includes(view) && !isPremium) {
          setIsUpgradeModalOpen(true);
      } else {
          setCurrentView(view);
      }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    const settingsDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/settings`, 'main');
    await setDoc(settingsDocRef, { weddingDate: tempWeddingDate }, { merge: true });
    setIsSettingsModalOpen(false);
    showAlert("Data nunții a fost salvată!", "Succes");
  };

  if (!isAuthReady) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-pink-500"></div></div>;
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderView = () => {
    const commonProps = { userId: user.uid, showAlert, showConfirm, isPremium, onUpgrade: () => setIsUpgradeModalOpen(true) };
    switch (currentView) {
      case 'panou': return <Dashboard userId={user.uid} weddingDate={weddingDate} stats={stats} onSettingsClick={() => setIsSettingsModalOpen(true)} />;
      case 'invitati': return <GuestList {...commonProps} />;
      case 'buget': return <Budget {...commonProps} />;
      case 'sarcini': return <TodoList {...commonProps} />;
      case 'furnizori': return <VendorList {...commonProps} />;
      case 'mese': return <SeatingChart {...commonProps} />;
      default: return <Dashboard userId={user.uid} weddingDate={weddingDate} stats={stats} onSettingsClick={() => setIsSettingsModalOpen(true)} />;
    }
  };
  
  const NavButton = ({ view, label, icon: Icon }) => (
    <button onClick={() => handleNavClick(view)} className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center sm:justify-start space-y-1 sm:space-y-0 sm:space-x-2 px-3 py-3 text-sm font-medium rounded-md transition-colors duration-150 ${currentView === view ? 'bg-pink-600 text-white shadow-lg' : 'text-pink-100 hover:bg-pink-500'}`}>
      <Icon size={20} /><span>{label}</span>
      {view === 'mese' && !isPremium && <Lock size={12} className="ml-1.5 opacity-80" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-pink-700 text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">Planificator de Nuntă</h1>
            <div className="flex items-center gap-4">
                {user && <span className="text-sm hidden sm:inline">Salut, {user.displayName || user.email}!</span>}
                <button onClick={handleLogout} className="bg-pink-100 text-pink-700 font-bold py-1 px-3 rounded-md text-sm hover:bg-pink-200 transition flex items-center gap-2">
                    <LogOut size={16}/> Deconectare
                </button>
            </div>
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
      <Modal isOpen={isConfirmOpen} onClose={closeConfirm} title={confirmTitle} type="warning"><p>{confirmMessage}</p><div className="flex justify-end space-x-3"><button onClick={closeConfirm} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md shadow-sm">Anulează</button><button onClick={handleConfirm} className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow">Confirmă</button></div></Modal>
      <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Setări Nuntă">
        <div><label htmlFor="weddingDate" className="block text-sm font-medium text-gray-700">Data Nunții:</label><input type="date" id="weddingDate" value={tempWeddingDate} onChange={e => setTempWeddingDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"/></div>
        <div className="mt-6 flex justify-end"><button onClick={handleSaveSettings} className="bg-pink-500 text-white font-semibold py-2 px-4 rounded-lg shadow">Salvează Setările</button></div>
      </Modal>
      <Modal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} title="Treci la Premium">
        <div className="text-center">
            <Star className="mx-auto h-16 w-16 text-yellow-400" />
            <h3 className="mt-4 text-2xl font-bold text-gray-900">Deblochează tot potențialul!</h3>
            <p className="mt-2 text-gray-600">Obține acces la funcționalități avansate pentru o planificare fără stres:</p>
            <ul className="mt-4 text-left space-y-2 text-gray-600 list-disc list-inside">
                <li><span className="font-semibold">Planificator de Buget Inteligent:</span> Primește sugestii de alocare a bugetului.</li>
                <li><span className="font-semibold">Aranjarea la Mese:</span> Organizează vizual invitații cu drag & drop.</li>
                <li>Și multe alte surprize pe viitor!</li>
            </ul>
            <div className="mt-6">
                <p className="text-3xl font-extrabold text-gray-900">Doar 99 lei</p>
                <p className="text-sm text-gray-500">Plată unică, acces pe viață.</p>
            </div>
            <button onClick={handleUpgrade} className="mt-6 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg text-lg">
                Activează Premium Acum
            </button>
        </div>
      </Modal>
    </div>
  );
}

export default App;
