import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, query, addDoc, updateDoc, deleteDoc, setDoc, getDoc, getDocs } from 'firebase/firestore';
import { Users, ListChecks, DollarSign, Briefcase, PlusCircle, Edit2, Trash2, Save, XCircle, CheckCircle, Circle, UserCircle2, AlertTriangle, LayoutDashboard, Table, Settings, CalendarHeart, Flower2, HelpCircle, MailQuestion, Lock, Star, LogOut, LogIn } from 'lucide-react';

// --- CONFIGURARE FIREBASE ---
const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = import.meta.env.VITE_APP_ID || 'planificator-nunta-app';

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
            { name: "Anunță logodna", description: "Împărtășește vestea bună cu familia și prietenii apropiați." },
            { name: "Stabilește viziunea nunții", description: "Discută despre stilul nunții: formal, casual, tematic etc." },
            { name: "Alege o perioadă a anului", description: "Decide anotimpul sau luna preferată pentru nuntă." }
        ],
        "Buget": [
            { name: "Stabilește bugetul total", description: "Discută cu partenerul și familia pentru a stabili un buget realist." },
            { name: "Creează un sistem de urmărire", description: "Folosește un spreadsheet sau o aplicație pentru a monitoriza cheltuielile." },
            { name: "Stabilește sursele de finanțare", description: "Clarifică cine contribuie și cu ce sumă." }
        ],
        "Invitați": [
            { name: "Creează lista preliminară de invitați", description: "Notează pe toți cei pe care doriți să-i invitați." },
            { name: "Adună adresele invitaților", description: "Creează un fișier centralizat cu datele de contact." }
        ],
        "Echipa de Nuntă": [
            { name: "Alege cavalerii și domnișoarele de onoare", description: "Gândește-te la persoanele cele mai apropiate." },
            { name: "Alege nașii", description: "Discută cu persoanele pe care le dorești ca părinți spirituali." }
        ]
    },
    "10-12 Luni": {
        "Locație & Biserică": [
            { name: "Vizitează și rezervă locația", description: "Asigură-te că locația corespunde viziunii și bugetului." },
            { name: "Rezervă biserica/locația ceremoniei", description: "Confirmă data și ora cu preotul sau oficiantul." }
        ],
        "Furnizori Cheie": [
            { name: "Angajează un wedding planner", description: "Dacă dorești ajutor specializat, acum este momentul." },
            { name: "Rezervă fotograful și videograful", description: "Cei mai buni sunt rezervați cu mult timp în avans." },
            { name: "Rezervă formația sau DJ-ul", description: "Muzica este esențială pentru atmosfera petrecerii." }
        ]
    },
    "8-10 Luni": {
        "Ținute & Verighete": [
            { name: "Începe căutarea rochiei de mireasă", description: "Probează diverse stiluri pentru a găsi rochia perfectă." },
            { name: "Comandă rochia de mireasă", description: "Livrarea și ajustările pot dura câteva luni." },
            { name: "Alege și comandă verighetele", description: "Asigură-te că ai măsurile corecte." }
        ],
        "Invitați & Save the Date": [
            { name: "Trimite 'Save the Date'", description: "Este important mai ales pentru invitații din afara localității." },
            { name: "Creează un website pentru nuntă", description: "Opțional, pentru a oferi detalii suplimentare." }
        ]
    },
    "6-8 Luni": {
        "Furnizori Secundari": [
            { name: "Rezervă florăria", description: "Discută despre buchete, aranjamente florale și decorațiuni." },
            { name: "Rezervă cofetăria pentru tort", description: "Programează o degustare pentru a alege aromele." },
            { name: "Stabilește meniul cu firma de catering", description: "Confirmă meniul final și numărul de porții." }
        ],
        "Planificare Lună de Miere": [
            { name: "Alege destinația pentru luna de miere", description: "Visează la locația perfectă pentru relaxare." },
            { name: "Rezervă zborurile și cazarea", description: "Profită de oferte și rezervă din timp." }
        ]
    },
    "4-6 Luni": {
        "Ținute & Accesorii": [
            { name: "Alege ținutele pentru domnișoarele de onoare", description: "Coordonează stilul și culorile." },
            { name: "Alege costumul pentru mire", description: "Asigură-te că se potrivește cu stilul nunții." },
            { name: "Cumpără pantofii și accesoriile", description: "Alege accesorii care completează ținutele." }
        ],
        "Detalii Eveniment": [
            { name: "Planifică degustarea meniului", description: "Confirmă alegerile culinare cu locația/cateringul." },
            { name: "Alege mărturiile pentru invitați", description: "Găsește un mic cadou simbolic pentru participanți." }
        ]
    },
    "3-4 Luni": {
        "Invitații & Papetărie": [
            { name: "Comandă invitațiile de nuntă", description: "Verifică textul și designul cu atenție." },
            { name: "Trimite invitațiile", description: "Respectă termenul clasic de 2-3 luni înainte de eveniment." }
        ],
        "Logistică": [
            { name: "Planifică cazarea pentru invitați", description: "Dacă ai invitați din alte orașe, oferă-le opțiuni de cazare." }
        ]
    },
    "2 Luni": {
        "Documente & Legal": [
            { name: "Aplică pentru certificatul de căsătorie", description: "Verifică valabilitatea actelor și termenul legal." },
            { name: "Adună toate documentele necesare", description: "Pregătește dosarul pentru cununia civilă și religioasă." }
        ],
        "Detalii Finale": [
            { name: "Programează proba pentru coafură și machiaj", description: "Asigură-te că look-ul final este cel dorit." },
            { name: "Stabilește playlist-ul cu DJ-ul/formația", description: "Include melodiile preferate și momentele cheie." }
        ]
    },
    "1 Lună": {
        "Confirmări & Plăți": [
            { name: "Confirmă numărul final de invitați", description: "Contactează invitații care nu au răspuns." },
            { name: "Confirmă detaliile finale cu toți furnizorii", description: "Verifică orele, locațiile și serviciile contractate." },
            { name: "Efectuează plățile finale", description: "Asigură-te că ai achitat toate avansurile și tranșele finale." }
        ],
        "Legal": [
            { name: "Depune actele la starea civilă", description: "Respectă termenul legal pentru depunerea dosarului." }
        ]
    },
    "1-2 Săptămâni": {
        "Finalizarea Detaliilor": [
            { name: "Creează planul final al aranjării la mese", description: "Folosește secțiunea 'Aranjare Mese' din aplicație." },
            { name: "Creează un program detaliat pentru ziua nunții", description: "Distribuie programul echipei de nuntă și furnizorilor." }
        ],
        "Pregătiri Personale": [
            { name: "Mergi la proba finală pentru rochie/costum", description: "Asigură-te că totul se potrivește perfect." },
            { name: "Pregătește bagajul pentru luna de miere", description: "Nu lăsa pe ultima sută de metri." }
        ]
    },
    "Ziua de Dinaintea Nunții": {
        "Relaxare & Verificare": [
            { name: "Predă elementele necesare la locație", description: "Mărturii, place card-uri, carte de oaspeți etc." },
            { name: "Fă o manichiură/pedichiură relaxantă", description: "Răsfață-te puțin înainte de ziua cea mare." },
            { name: "Odihnește-te bine!", description: "Un somn bun este esențial." }
        ]
    }
};


// --- COMPONENTE ---

const TrialInfoBanner = ({ daysLeft, onUpgrade }) => {
    if (daysLeft <= 0) return null;

    return (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-center p-3 rounded-lg shadow-md my-4 container mx-auto flex items-center justify-center gap-4">
            <Star className="text-white flex-shrink-0" size={24} />
            <p className="font-semibold">
                Perioada de probă este activă! Mai ai {daysLeft} {daysLeft === 1 ? 'zi' : 'zile'} de acces Premium gratuit.
            </p>
            <button onClick={onUpgrade} className="bg-white text-yellow-800 font-bold py-1 px-4 rounded-full text-sm hover:bg-yellow-100 transition-colors flex-shrink-0">
                Activează Acum
            </button>
        </div>
    );
};

const TrialExpiredScreen = ({ onUpgrade }) => (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-full max-w-lg p-8 space-y-8 bg-white rounded-xl shadow-2xl text-center">
            <Star className="mx-auto h-16 w-16 text-yellow-400" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Perioada de probă a expirat!</h2>
            <p className="mt-2 text-gray-600">
                Mulțumim că ai încercat Planificatorul de Nuntă. Pentru a continua să folosești aplicația și a-ți accesa datele, te rugăm să activezi un cont Premium.
            </p>
            <div className="mt-6">
                <p className="text-3xl font-extrabold text-gray-900">Doar 99 lei (aprox. 20€)</p>
                <p className="text-sm text-gray-500">Plată unică, acces pe viață.</p>
            </div>
            <button
                onClick={onUpgrade}
                className="mt-6 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg text-lg transition-transform transform hover:scale-105"
            >
                Activează Premium Acum
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
                <StatCard icon={DollarSign} value={`${stats.budgetSpent.toFixed(0)} RON`} label="Buget Cheltuit" color="border-green-500"/>
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
    const [filterStatus, setFilterStatus] = useState('All'); // 'All', 'Așteaptă', 'Confirmat', 'Refuzat', 'Poate'
    const guestsCollectionPath = `artifacts/${appId}/users/${userId}/guests`;

    useEffect(() => {
        if (!userId) return;
        const q = query(collection(db, guestsCollectionPath));
        const unsubscribe = onSnapshot(q, (snap) => {
            setGuests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => showAlert(`Eroare la citirea invitaților: ${error.message}`, "Eroare"));
        return () => unsubscribe();
    }, [userId, showAlert]);

    const handleAddOrUpdateGuest = async () => {
        if (!newGuestName.trim()) {
            showAlert("Numele este obligatoriu.", "Eroare");
            return;
        }
        const guestData = { name: newGuestName, rsvp: newGuestRsvp, notes: newGuestNotes };
        try {
            if (currentGuest) {
                await updateDoc(doc(db, guestsCollectionPath, currentGuest.id), guestData);
            } else {
                await addDoc(collection(db, guestsCollectionPath), guestData);
            }
            closeModal();
        } catch (error) {
            showAlert(`Eroare la salvarea invitatului: ${error.message}`, "Eroare");
        }
    };

    const handleDeleteGuest = (guestId) => {
        showConfirm("Sigur dorești să ștergi acest invitat?", "Confirmare Ștergere", async () => {
            try {
                await deleteDoc(doc(db, guestsCollectionPath, guestId));
            } catch (error) {
                showAlert(`Eroare la ștergerea invitatului: ${error.message}`, "Eroare");
            }
        });
    };

    const openModal = (guest = null) => {
        setCurrentGuest(guest);
        setNewGuestName(guest?.name || '');
        setNewGuestRsvp(guest?.rsvp || 'Așteaptă');
        setNewGuestNotes(guest?.notes || '');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentGuest(null);
    };
    
    const filteredGuests = guests.filter(g => {
        const nameMatch = g.name.toLowerCase().includes(searchTerm.toLowerCase());
        const statusMatch = filterStatus === 'All' || g.rsvp === filterStatus;
        return nameMatch && statusMatch;
    });

    const RsvpIcon = ({ status }) => {
        switch (status) {
            case 'Confirmat': return <CheckCircle className="text-green-500" size={20} />;
            case 'Refuzat': return <XCircle className="text-red-500" size={20} />;
            case 'Poate': return <MailQuestion className="text-blue-500" size={20} />;
            case 'Așteaptă': default: return <HelpCircle className="text-yellow-500" size={20} />;
        }
    };

    const FilterButton = ({ status, label, count }) => (
        <button
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full flex items-center gap-2 transition-all duration-200 ease-in-out border ${
                filterStatus === status
                    ? 'bg-pink-600 text-white border-pink-700 shadow-md'
                    : 'bg-white text-pink-700 border-pink-200 hover:bg-pink-100 hover:border-pink-300'
            }`}
        >
            {label}
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                filterStatus === status ? 'bg-white text-pink-600' : 'bg-pink-200 text-pink-700'
            }`}>
                {count}
            </span>
        </button>
    );

    return (
        <div className="p-6 bg-pink-50 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-pink-700">Listă Invitați</h2>
                <button onClick={() => openModal()} className="bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center transition">
                    <PlusCircle size={20} className="mr-2" /> Adaugă Invitat
                </button>
            </div>
            
            <input type="text" placeholder="Caută invitat după nume..." className="w-full p-2 mb-4 border border-pink-300 rounded-lg focus:ring-pink-500 focus:border-pink-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />

            <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-pink-200">
                <FilterButton status="All" label="Toți" count={guests.length} />
                <FilterButton status="Confirmat" label="Confirmați" count={guests.filter(g => g.rsvp === 'Confirmat').length} />
                <FilterButton status="Așteaptă" label="Așteaptă" count={guests.filter(g => g.rsvp === 'Așteaptă').length} />
                <FilterButton status="Refuzat" label="Refuzați" count={guests.filter(g => g.rsvp === 'Refuzat').length} />
                <FilterButton status="Poate" label="Poate" count={guests.filter(g => g.rsvp === 'Poate').length} />
            </div>

            {filteredGuests.length === 0 && <p className="text-center text-gray-600 py-8">Niciun invitat nu corespunde filtrelor selectate.</p>}
            
            <div className="space-y-4">
                {filteredGuests.map(guest => (
                    <div key={guest.id} className="bg-white p-4 rounded-lg shadow-sm border border-pink-200 flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-medium text-pink-800">{guest.name}</h3>
                            <div className="flex items-center mt-1">
                                <RsvpIcon status={guest.rsvp} />
                                <p className="text-sm ml-2">{guest.rsvp}</p>
                            </div>
                            {guest.notes && <p className="text-xs text-gray-500 mt-2 italic">Notițe: {guest.notes}</p>}
                        </div>
                        <div className="flex space-x-2">
                            <button onClick={() => openModal(guest)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={18} /></button>
                            <button onClick={() => handleDeleteGuest(guest.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={18} /></button>
                        </div>
                    </div>
                ))}
            </div>
            
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


// --- COMPONENTA PRINCIPALĂ PENTRU BUGET (VERSIUNE NOUĂ) ---
const Budget = ({ db, userId, appId, showAlert, showConfirm }) => {
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
    const settingsDocPath = `artifacts/${appId}/users/${userId}/settings`;
    const categories = ['Locație', 'Mâncare & Băutură', 'Fotograf/Videograf', 'Muzică/DJ', 'Ținute', 'Decorațiuni', 'Invitații', 'Verighete', 'Transport', 'Diverse'];
    
    const budgetAllocation = {
        'Locație': 0.24, 'Mâncare & Băutură': 0.24, 'Fotograf/Videograf': 0.10, 'Muzică/DJ': 0.08,
        'Ținute': 0.12, 'Decorațiuni': 0.07, 'Invitații': 0.03, 'Verighete': 0.03, 'Transport': 0.02, 'Diverse': 0.07,
    };

    useEffect(() => {
        if (!userId || !db) return;
        const settingsDocRef = doc(db, settingsDocPath, 'main');
        const unsubSettings = onSnapshot(settingsDocRef, (doc) => {
            if (doc.exists() && doc.data().totalBudget) {
                const budget = doc.data().totalBudget;
                setTotalBudget(budget);
                setTempTotalBudget(budget.toString());
            }
        });
        const q = query(collection(db, budgetCollectionPath));
        const unsubItems = onSnapshot(q, (snap) => setItems(snap.docs.map(d => ({id: d.id, ...d.data()}))), (err) => showAlert(`Eroare la citirea bugetului: ${err.message}`, "Eroare"));
        
        return () => { 
            unsubSettings(); 
            unsubItems(); 
        };
    }, [userId, db, settingsDocPath, budgetCollectionPath, showAlert]);

    const handleSaveTotalBudget = async () => {
        const newTotal = parseFloat(tempTotalBudget);
        if (isNaN(newTotal) || newTotal < 0) { showAlert("Vă rugăm introduceți o sumă validă.", "Eroare"); return; }
        const settingsDocRef = doc(db, settingsDocPath, 'main');
        await setDoc(settingsDocRef, { totalBudget: newTotal }, { merge: true });
        setIsBudgetModalOpen(false);
        showAlert("Bugetul total a fost salvat!", "Succes");
    };
    
    const handleAddOrUpdateItem = async () => {
        if (!itemName.trim() || !estimatedCost.trim()) {
            showAlert("Numele și costul estimat sunt obligatorii.", "Validare Eșuată");
            return;
        }

        const estCost = parseFloat(estimatedCost) || 0;
        let actCost;

        if (currentItem) { // This is an UPDATE
            actCost = actualCost ? (parseFloat(actualCost) || 0) : 0;
        } else { // This is a NEW item
            actCost = actualCost ? (parseFloat(actualCost) || 0) : estCost;
        }

        const itemData = {
            name: itemName,
            category,
            estimatedCost: estCost,
            actualCost: actCost,
            paid: isPaid
        };

        try {
            if (currentItem) {
                await updateDoc(doc(db, budgetCollectionPath, currentItem.id), itemData);
            } else {
                await addDoc(collection(db, budgetCollectionPath), itemData);
            }
            closeItemModal();
        } catch (err) {
            showAlert(`Eroare la salvarea cheltuielii: ${err.message}`, "Eroare");
        }
    };

    const handleDeleteItem = (itemId) => { 
        showConfirm("Sigur dorești să ștergi această cheltuială?", "Confirmare Ștergere", async () => { 
            try { 
                await deleteDoc(doc(db, budgetCollectionPath, itemId)); 
            } catch (err) { 
                showAlert(`Eroare la ștergere: ${err.message}`, "Eroare"); 
            } 
        }); 
    };
    
    const togglePaidStatus = async (item) => { 
        try { 
            await updateDoc(doc(db, budgetCollectionPath, item.id), { paid: !item.paid }); 
        } catch (err) { 
            showAlert(`Eroare la actualizare: ${err.message}`, "Eroare"); 
        } 
    };
    
    const openItemModal = (item = null) => { 
        setCurrentItem(item); 
        setItemName(item?.name || ''); 
        setCategory(item?.category || 'Locație'); 
        setEstimatedCost(item?.estimatedCost?.toString() || ''); 
        setActualCost(item?.actualCost?.toString() || ''); 
        setIsPaid(item?.paid || false); 
        setIsItemModalOpen(true); 
    };
    
    const closeItemModal = () => { 
        setIsItemModalOpen(false); 
        setCurrentItem(null); 
    };
    
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
            <div className="p-6 bg-white rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-green-800">Planificator Buget</h3>
                    <button onClick={() => setIsBudgetModalOpen(true)} className="bg-green-200 text-green-800 hover:bg-green-300 font-semibold py-2 px-4 rounded-lg text-sm">Setează Bugetul Total</button>
                </div>
                {totalBudget > 0 ? (
                    <div>
                        <p className="text-center text-gray-600 mb-4">Buget total propus: <span className="font-bold text-lg">{totalBudget.toFixed(0)} RON</span></p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(budgetAllocation).map(([category, percentage]) => {
                                const suggested = totalBudget * percentage;
                                const spent = spentPerCategory[category] || 0;
                                const difference = suggested - spent;
                                const progress = suggested > 0 ? (spent / suggested) * 100 : 0;
                                return (
                                    <div key={category} className="p-4 border rounded-lg bg-gray-50">
                                        <h4 className="font-bold text-gray-700">{category}</h4>
                                        <p className="text-xs text-gray-500">Sugerăm: {suggested.toFixed(0)} RON ({(percentage * 100).toFixed(0)}%)</p>
                                        <p className="text-sm font-semibold">Cheltuit: {spent.toFixed(0)} RON</p>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 my-2"><div className={`h-2.5 rounded-full ${progress > 100 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(progress, 100)}%` }}></div></div>
                                        <p className={`text-xs font-medium ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>{difference >= 0 ? `Rămas: ${difference.toFixed(0)} RON` : `Depășit: ${Math.abs(difference).toFixed(0)} RON`}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (<p className="text-center text-gray-500">Setați un buget total pentru a vedea sugestiile de alocare a cheltuielilor.</p>)}
            </div>

            {/* Tracker Section */}
            <div>
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-semibold text-green-700">Urmărire Cheltuieli</h2><button onClick={() => openItemModal()} className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center"><PlusCircle size={20} className="mr-2" /> Adaugă Cheltuială</button></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-white rounded-lg shadow border-l-4 border-green-300"><h4 className="text-sm font-medium text-gray-500">Total Estimat</h4><p className="text-2xl font-bold text-green-700">{totalEstimated.toFixed(0)} RON</p></div>
                    <div className="p-4 bg-white rounded-lg shadow border-l-4 border-green-400"><h4 className="text-sm font-medium text-gray-500">Total Cheltuit (Actual)</h4><p className="text-2xl font-bold text-green-700">{totalActual.toFixed(0)} RON</p></div>
                    <div className="p-4 bg-white rounded-lg shadow border-l-4 border-green-500"><h4 className="text-sm font-medium text-gray-500">Total Plătit</h4><p className="text-2xl font-bold text-green-700">{totalPaid.toFixed(0)} RON</p></div>
                </div>
                <div className="space-y-4">{items.map((item) => (<div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-green-200"><div className="flex justify-between items-start"><div><h3 className="text-lg font-medium text-green-800">{item.name} <span className="text-xs text-gray-500">({item.category})</span></h3><p className="text-sm text-gray-600">Estimat: {(item.estimatedCost || 0).toFixed(0)} RON</p>{item.actualCost > 0 && <p className="text-sm text-gray-600">Actual: {(item.actualCost || 0).toFixed(0)} RON</p>}</div><div className="flex items-center space-x-3"><button onClick={() => togglePaidStatus(item)} className={`p-1 rounded-full ${item.paid ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`} title={item.paid ? "Marchează ca neplătit" : "Marchează ca plătit"}>{item.paid ? <CheckCircle size={18} /> : <Circle size={18} />}</button><button onClick={() => openItemModal(item)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={18} /></button><button onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={18} /></button></div></div></div>))}</div>
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

const SeatingChart = ({ userId, showAlert }) => {
    const [guests, setGuests] = useState([]);
    const [tables, setTables] = useState([]);
    const [newTableName, setNewTableName] = useState("");
    const [draggedOverTarget, setDraggedOverTarget] = useState(null); // Can be table ID or 'unassigned'

    const guestsCollectionPath = `artifacts/${appId}/users/${userId}/guests`;
    const seatingCollectionPath = `artifacts/${appId}/users/${userId}/seating`;

    useEffect(() => {
        if (!userId) return;
        const unsubGuests = onSnapshot(query(collection(db, guestsCollectionPath)), (snap) => {
            const confirmedGuests = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(g => g.rsvp === 'Confirmat');
            setGuests(confirmedGuests);
        });
        const unsubSeating = onSnapshot(doc(db, seatingCollectionPath, 'layout'), (docSnap) => {
            if (docSnap.exists()) {
                setTables(docSnap.data().tables || []);
            }
        });
        return () => { unsubGuests(); unsubSeating(); };
    }, [userId]);

    const handleAddTable = async () => {
        if (!newTableName.trim()) { showAlert("Numele mesei este obligatoriu.", "Eroare"); return; }
        const updatedTables = [...tables, { id: crypto.randomUUID(), name: newTableName, guests: [] }];
        await setDoc(doc(db, seatingCollectionPath, 'layout'), { tables: updatedTables }, { merge: true });
        setNewTableName("");
    };

    const handleDeleteTable = async (tableId) => {
        const tableToDelete = tables.find(t => t.id === tableId);
        if (tableToDelete && tableToDelete.guests.length > 0) {
            showAlert("Nu poți șterge o masă care are invitați alocați.", "Eroare");
            return;
        }
        const updatedTables = tables.filter(t => t.id !== tableId);
        await setDoc(doc(db, seatingCollectionPath, 'layout'), { tables: updatedTables });
    };

    const handleDrop = async (e, targetTableId) => {
        e.preventDefault();
        setDraggedOverTarget(null);
        const guestId = e.dataTransfer.getData("guestId");
        if (!guestId) return;

        const guestBeingDragged = guests.find(g => g.id === guestId);
        if (!guestBeingDragged) return;

        let newTables = tables.map(table => ({
            ...table,
            guests: table.guests.filter(g => g.id !== guestId)
        }));

        if (targetTableId) {
            const targetTable = newTables.find(t => t.id === targetTableId);
            if (targetTable) {
                targetTable.guests.push(guestBeingDragged);
            }
        }
        await setDoc(doc(db, seatingCollectionPath, 'layout'), { tables: newTables });
    };

    const handleDragStart = (e, guestId) => e.dataTransfer.setData("guestId", guestId);
    
    const unassignedGuests = guests.filter(g => !tables.some(t => t.guests.some(guestInTable => guestInTable.id === g.id)));

    return (
        <div className="p-4 md:p-6 bg-indigo-50 rounded-lg shadow-md flex flex-col md:flex-row gap-4">
            <div 
                className={`w-full md:w-1/3 bg-white p-2 md:p-4 rounded-lg shadow-inner flex flex-col min-w-0 transition-colors ${draggedOverTarget === 'unassigned' ? 'bg-indigo-100' : ''}`}
                onDragOver={e => e.preventDefault()}
                onDragEnter={() => setDraggedOverTarget('unassigned')}
                onDragLeave={() => setDraggedOverTarget(null)}
                onDrop={(e) => handleDrop(e, null)}
            >
                <h3 className="text-base md:text-lg font-semibold text-indigo-800 mb-4 sticky top-0 bg-white pb-2 z-10">Invitați Nealocați ({unassignedGuests.length})</h3>
                 <p className="text-xs text-gray-500 mb-2">Doar invitații confirmați apar aici. Trage-i la o masă.</p>
                <div className="space-y-2 overflow-y-auto">
                    {unassignedGuests.map(guest => (
                        <div key={guest.id} draggable onDragStart={(e) => handleDragStart(e, guest.id)} className="p-2 text-sm bg-indigo-100 rounded cursor-grab shadow-sm hover:shadow-md transition-shadow truncate">
                            {guest.name}
                        </div>
                    ))}
                </div>
            </div>
            <div className="w-full md:w-2/3 min-w-0">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <h2 className="text-xl md:text-2xl font-semibold text-indigo-700">Aranjarea la Mese</h2>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <input type="text" value={newTableName} onChange={e => setNewTableName(e.target.value)} placeholder="Nume masă" className="p-2 border rounded-lg w-full sm:w-auto"/>
                        <button onClick={handleAddTable} className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center justify-center"><PlusCircle size={20} className="mr-2"/> Adaugă</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {tables.map(table => (
                        <div 
                            key={table.id} 
                            onDragOver={e => e.preventDefault()}
                            onDragEnter={() => setDraggedOverTarget(table.id)}
                            onDragLeave={() => setDraggedOverTarget(null)}
                            onDrop={e => handleDrop(e, table.id)}
                            className={`p-4 rounded-lg shadow-lg border-t-4 border-indigo-400 min-h-[200px] transition-colors ${draggedOverTarget === table.id ? 'bg-indigo-100' : 'bg-white'}`}
                        >
                            <div className="flex justify-between items-center mb-3 border-b pb-2">
                                <h4 className="font-bold text-indigo-800 truncate">{table.name}</h4>
                                <button onClick={() => handleDeleteTable(table.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                            </div>
                            <div className="space-y-2">
                                {table.guests.map(guest => (
                                    <div key={guest.id} draggable onDragStart={(e) => handleDragStart(e, guest.id)} className="p-1.5 bg-gray-100 rounded text-sm cursor-grab truncate">
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
                    <h2 className="mt-6 text-3xl font-bold text-gray-900">Bine ai revenit!</h2>
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


// Componenta principală APP
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
  const [subscriptionStatus, setSubscriptionStatus] = useState('none');
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
                await setDoc(userDocRef, {
                    createdAt: new Date(),
                    subscriptionStatus: 'trialing'
                });
            }

            const unsubUser = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const status = data.subscriptionStatus;
                    const createdAt = data.createdAt?.toDate();
                    
                    let premiumStatus = false;
                    let trialDaysLeft = 0;

                    if (status === 'active') {
                        premiumStatus = true;
                    } else if (status === 'trialing' && createdAt) {
                        const now = new Date();
                        const trialEndDate = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
                        
                        if (now < trialEndDate) {
                            premiumStatus = true;
                            trialDaysLeft = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));
                        } else {
                            updateDoc(userDocRef, { subscriptionStatus: 'trial_expired' });
                            premiumStatus = false;
                        }
                    }
                    
                    setIsPremium(premiumStatus);
                    setSubscriptionStatus(status);
                    setTrialDaysRemaining(trialDaysLeft);
                } else {
                    setIsPremium(false);
                    setSubscriptionStatus('none');
                }
            });

            const guestsPath = `artifacts/${appId}/users/${user.uid}/guests`;
            const budgetPath = `artifacts/${appId}/users/${user.uid}/budgetItems`;
            const tasksPath = `artifacts/${appId}/users/${user.uid}/tasks`;
            const settingsPath = doc(db, `artifacts/${appId}/users/${user.uid}/settings`, 'main');

            const unsubGuests = onSnapshot(query(collection(db, guestsPath)), (snap) => setStats(s => ({ ...s, guestsTotal: snap.docs.length, guestsConfirmed: snap.docs.filter(d => d.data().rsvp === 'Confirmat').length })));
            const unsubBudget = onSnapshot(query(collection(db, budgetPath)), (snap) => setStats(s => ({ ...s, budgetSpent: snap.docs.reduce((sum, doc) => sum + (Number(doc.data().actualCost) || 0), 0) })));
            const unsubTasks = onSnapshot(query(collection(db, tasksPath)), (snap) => setStats(s => ({ ...s, tasksTotal: snap.docs.length, tasksCompleted: snap.docs.filter(d => d.data().completed).length })));
            const unsubWeddingDate = onSnapshot(settingsPath, (doc) => { if (doc.exists()) { const data = doc.data(); setWeddingDate(data.weddingDate); setTempWeddingDate(data.weddingDate || ""); } });
            
            setUser(user);
            setIsAuthReady(true);
            return () => { unsubUser(); unsubGuests(); unsubBudget(); unsubTasks(); unsubWeddingDate(); };
        } else {
            setUser(null);
            setIsAuthReady(true);
        }
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
      setIsUpgradeModalOpen(true);
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

  // Aici este noua logică de blocare totală
  if (!isPremium && subscriptionStatus === 'trial_expired') {
      return (
          <>
              <TrialExpiredScreen onUpgrade={handleUpgrade} />
              <Modal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} title="Treci la Premium">
                <div className="text-center">
                    <p className="p-3 mb-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-r-lg text-left font-bold">Perioada de probă a expirat!</p>
                    <Star className="mx-auto h-16 w-16 text-yellow-400" />
                    <h3 className="mt-4 text-2xl font-bold text-gray-900">Deblochează tot potențialul!</h3>
                    <div className="mt-6">
                        <p className="text-3xl font-extrabold text-gray-900">Doar 99 lei (aprox. 20€)</p>
                        <p className="text-sm text-gray-500">Plată unică, acces pe viață.</p>
                    </div>
                    <button onClick={() => showAlert("Funcționalitatea de plată nu este încă implementată.", "Info")} className="mt-6 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg text-lg">
                        Activează Premium Acum
                    </button>
                </div>
              </Modal>
          </>
      );
  }

  const renderView = () => {
    const commonProps = { userId: user.uid, showAlert, showConfirm };
    switch (currentView) {
      case 'panou': return <Dashboard userId={user.uid} weddingDate={weddingDate} stats={stats} onSettingsClick={() => setIsSettingsModalOpen(true)} />;
      case 'invitati': return <GuestList {...commonProps} />;
      case 'buget': return <Budget db={db} appId={appId} {...commonProps} />;
      case 'sarcini': return <TodoList {...commonProps} />;
      case 'furnizori': return <VendorList {...commonProps} />;
      case 'mese': return <SeatingChart {...commonProps} />;
      default: return <Dashboard userId={user.uid} weddingDate={weddingDate} stats={stats} onSettingsClick={() => setIsSettingsModalOpen(true)} />;
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

      {subscriptionStatus === 'trialing' && <TrialInfoBanner daysLeft={trialDaysRemaining} onUpgrade={handleUpgrade} />}

      <main className="container mx-auto p-4 sm:p-6">{renderView()}</main>

      <footer className="text-center py-6 text-sm text-pink-700"><p>&copy; {new Date().getFullYear()} Planificatorul Tău de Nuntă</p></footer>
      
      <Modal isOpen={isAlertOpen} onClose={closeAlert} title={alertTitle} type={alertTitle.toLowerCase().includes('eroare') ? 'error' : 'default'}><p>{alertMessage}</p><div className="mt-6 flex justify-end"><button onClick={closeAlert} className="px-4 py-2 text-sm font-medium text-white bg-pink-500 hover:bg-pink-600 rounded-md">OK</button></div></Modal>
      <Modal isOpen={isConfirmOpen} onClose={closeConfirm} title={confirmTitle} type="warning"><p>{confirmMessage}</p><div className="mt-6 flex justify-end space-x-3"><button onClick={closeConfirm} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md shadow-sm">Anulează</button><button onClick={handleConfirm} className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow">Confirmă</button></div></Modal>
      <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Setări Nuntă">
        <div><label htmlFor="weddingDate" className="block text-sm font-medium text-gray-700">Data Nunții:</label><input type="date" id="weddingDate" value={tempWeddingDate} onChange={e => setTempWeddingDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"/></div>
        <div className="mt-6 flex justify-end"><button onClick={handleSaveSettings} className="bg-pink-500 text-white font-semibold py-2 px-4 rounded-lg shadow">Salvează Setările</button></div>
      </Modal>
      <Modal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} title="Treci la Premium">
        <div className="text-center">
             {subscriptionStatus === 'trial_expired' && (
                <div className="p-3 mb-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-r-lg text-left">
                    <p className="font-bold">Perioada de probă a expirat!</p>
                    <p className="text-sm">Activează premium pentru a redobândi accesul la toate funcționalitățile.</p>
                </div>
            )}
            <Star className="mx-auto h-16 w-16 text-yellow-400" />
            <h3 className="mt-4 text-2xl font-bold text-gray-900">Deblochează tot potențialul!</h3>
            <p className="mt-2 text-gray-600">Obține acces la funcționalități avansate pentru o planificare fără stres:</p>
            <ul className="mt-4 text-left space-y-2 text-gray-600 list-disc list-inside">
                <li><span className="font-semibold">Planificator de Buget Inteligent:</span> Primește sugestii de alocare a bugetului.</li>
                <li><span className="font-semibold">Aranjarea la Mese:</span> Organizează vizual invitații cu drag & drop.</li>
                <li>Și multe alte surprize pe viitor!</li>
            </ul>
            <div className="mt-6">
                <p className="text-3xl font-extrabold text-gray-900">Doar 99 lei (aprox. 20€)</p>
                <p className="text-sm text-gray-500">Plată unică, acces pe viață.</p>
            </div>
            <button onClick={() => showAlert("Funcționalitatea de plată nu este încă implementată.", "Info")} className="mt-6 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg text-lg">
                Activează Premium Acum
            </button>
        </div>
      </Modal>
    </div>
  );
}

export default App;
