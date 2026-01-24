import React, { useState } from 'react';

const UserProfile = ({ store, onClose }) => {
    const { state, updateProfile } = store;
    const u = state.currentUser;
    
    const [form, setForm] = useState({ 
        name: u.name, 
        username: u.username, 
        email: u.email || '', 
        password: u.password, 
        avatar: u.avatar || '' 
    });
    const [msg, setMsg] = useState('');

    // 1. Image Compression Logic
    const handleFile = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    ctx?.drawImage(img, 0, 0, width, height);
                    
                    // Compress to JPEG at 70% quality
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    setForm({...form, avatar: compressedDataUrl});
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    // 2. Remove Photo Logic
    const removePhoto = () => {
        setForm({ ...form, avatar: '' });
    };

    const save = async () => {
        const res = await updateProfile(u.id, form);
        if(res.success) { 
            setMsg('Saved!'); 
            // 3. Auto-Refresh Logic
            setTimeout(() => {
                onClose();
                window.location.reload(); // Force reloads the page to update UI everywhere
            }, 1000); 
        }
        else setMsg(res.error);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
            <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative">
                
                {/* Close Button (Mobile Friendly) */}
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 p-2"
                >
                    <i className="fas fa-times text-xl"></i>
                </button>

                <h2 className="text-xl font-black mb-6 text-slate-900">Edit Profile</h2>
                
                {/* Avatar Section */}
                <div className="flex justify-center mb-6">
                    <div className="relative">
                        <div className="relative w-24 h-24 rounded-full bg-slate-100 overflow-hidden border-2 border-indigo-100 group">
                            {form.avatar ? (
                                <img src={form.avatar} className="w-full h-full object-cover" alt="Avatar"/>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-3xl font-black text-slate-300">
                                    {u.name[0]}
                                </div>
                            )}
                            
                            <label className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                <i className="fas fa-camera"></i>
                                <input type="file" className="hidden" accept="image/*" onChange={handleFile} />
                            </label>
                        </div>

                        {form.avatar && (
                            <button 
                                onClick={removePhoto}
                                className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-md border-2 border-white transition-colors z-10"
                                title="Remove photo"
                            >
                                <i className="fas fa-times text-xs"></i>
                            </button>
                        )}
                    </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase mb-1 ml-1">Full Name</label>
                        <input className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none focus:border-indigo-500 transition-colors font-bold text-sm" 
                            placeholder="Full Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase mb-1 ml-1">Username</label>
                        <input className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none focus:border-indigo-500 transition-colors font-bold text-sm" 
                            placeholder="Username" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase mb-1 ml-1">Email</label>
                        <input className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none focus:border-indigo-500 transition-colors font-bold text-sm" 
                            placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase mb-1 ml-1">Password</label>
                        <input className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none focus:border-indigo-500 transition-colors font-bold text-sm" type="password" 
                            placeholder="New Password (Optional)" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} />
                    </div>
                </div>
                
                {msg && <p className={`text-center mt-4 text-xs font-black uppercase tracking-wider ${msg==='Saved!'?'text-green-600':'text-red-500'}`}>{msg}</p>}

                <div className="flex gap-3 mt-8">
                    <button onClick={save} className="flex-1 bg-indigo-600 text-white py-3.5 rounded-xl font-black text-sm uppercase shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all">Save Changes</button>
                    <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-500 py-3.5 rounded-xl font-black text-sm uppercase hover:bg-slate-200 active:scale-95 transition-all">Cancel</button>
                </div>
            </div>
        </div>
    );
};
export default UserProfile;