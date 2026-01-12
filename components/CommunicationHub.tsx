import React, { useState, useEffect, Component, ReactNode } from 'react';

// --- COMPONENT: ERROR BOUNDARY (Prevents White Screen of Death) ---
// This isolates crashes to a single message bubble instead of the whole app
class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean}> {
    state = { hasError: false };
    static getDerivedStateFromError(_: Error) { return { hasError: true }; }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-2 mb-2 bg-red-50 border border-red-100 rounded text-[10px] text-red-500 flex items-center gap-2">
                    <i className="fas fa-exclamation-circle"></i> Message failed to load (Corrupted Data)
                </div>
            );
        }
        return this.props.children;
    }
}

// --- SUB-COMPONENT: IMAGE VIEWER (Zoom/Download) ---
const ImageViewer = ({ src, onClose }: { src: string, onClose: () => void }) => {
    const [scale, setScale] = useState(1);
    const fullSrc = src.startsWith('data:') || src.startsWith('http') ? src : `http://localhost:3001${src}`;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col justify-center items-center animate-fadeIn" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="absolute top-5 right-5 flex gap-4">
                 <a href={fullSrc} download="download.jpg" className="text-white bg-white/20 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/30 backdrop-blur-sm transition-all" title="Download">
                    <i className="fas fa-download"></i>
                </a>
                <button onClick={() => setScale(s => s + 0.25)} className="text-white bg-white/20 w-10 h-10 rounded-full hover:bg-white/30 backdrop-blur-sm transition-all" title="Zoom In">
                    <i className="fas fa-search-plus"></i>
                </button>
                <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="text-white bg-white/20 w-10 h-10 rounded-full hover:bg-white/30 backdrop-blur-sm transition-all" title="Zoom Out">
                    <i className="fas fa-search-minus"></i>
                </button>
                <button onClick={onClose} className="text-white bg-red-500/80 w-10 h-10 rounded-full hover:bg-red-600 backdrop-blur-sm transition-all" title="Close">
                    <i className="fas fa-times"></i>
                </button>
            </div>
            <div className="overflow-auto w-full h-full flex items-center justify-center p-4">
                 <img 
                    src={fullSrc} 
                    style={{ transform: `scale(${scale})`, transition: 'transform 0.2s ease-out' }} 
                    className="max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl" 
                    alt="Full View" 
                 />
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: CHAT BUBBLE (Hardened Logic) ---
const ChatBubble = ({ msg, isMe, role, onImageClick, onDelete }: any) => {
    if (!msg) return null;

    // CRASH FIX: Defensive Check. If msg.content is null, default to empty string.
    // This prevents "cannot read properties of null (reading 'startsWith')"
    const safeContent = msg.message || msg.content || "";
    const isFile = !!msg.fileName; 
    
    return (
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4 animate-fadeIn group`}>
            <div className={`max-w-[85%] p-3.5 rounded-2xl shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'}`}>
                
                {/* Header */}
                <div className="flex items-center gap-2 mb-1.5 border-b border-white/10 pb-1">
                    <span className="text-xs font-bold opacity-90">{msg.senderName}</span>
                    {!isMe && <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{role}</span>}
                </div>
                
                {/* Content */}
                <div className="text-sm leading-relaxed">
                    {msg.isImage ? (
                        <img 
                            src={safeContent.startsWith('data:') ? safeContent : `http://localhost:3001${safeContent}`}
                            alt="Shared Image" 
                            className="max-w-[240px] rounded-lg cursor-pointer hover:opacity-95 transition-opacity border-2 border-transparent hover:border-white/20" 
                            onClick={() => onImageClick(safeContent)} 
                        />
                    ) : isFile ? (
                        <a href={safeContent.startsWith('http') ? safeContent : `http://localhost:3001${safeContent}`} download={msg.fileName} className={`flex items-center gap-3 p-2.5 rounded-xl ${isMe ? 'bg-indigo-500 hover:bg-indigo-400' : 'bg-slate-50 hover:bg-slate-100'} transition-colors`}>
                            <div className="bg-white/20 p-2.5 rounded-lg">
                                <i className="fas fa-file-alt text-lg"></i>
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="font-bold truncate max-w-[180px] text-xs">{msg.fileName}</span>
                                <span className="text-[10px] opacity-75">Click to Download</span>
                            </div>
                        </a>
                    ) : (
                        // Fix #4: Added 'break-words' and 'break-all' to stop horizontal scrolling
                        <p className="whitespace-pre-wrap break-words break-all">{safeContent}</p>
                    )}
                </div>

                {/* Footer: Time + Delete Button (Fix #4 spacing) */}
                <div className={`flex justify-between items-center mt-2 pt-1 border-t ${isMe ? 'border-indigo-500/30' : 'border-slate-100'}`}>
                    <span className="text-[10px] opacity-60 font-medium">
                        {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    
                    {(isMe || role === 'ADMIN' || role === 'PROJECT_MANAGER') && (
                        <button 
                            onClick={() => onDelete(msg.id)}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity ml-4 px-2 py-0.5 rounded hover:bg-black/10 text-[10px] text-red-300 hover:text-red-500`}
                            title="Delete Message"
                        >
                            <i className="fas fa-trash"></i>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
const CommunicationHub = ({ store }: any) => {
    const { state, sendMessage, fetchChat, fetchForum, createThread, createComment } = store; 
    const [mode, setMode] = useState<'CHAT' | 'FORUM'>('CHAT');
    
    const [msg, setMsg] = useState('');
    const [channel, setChannel] = useState('General');

    const [viewImage, setViewImage] = useState<string | null>(null);

    const [viewThread, setViewThread] = useState<any>(null);
    const [newThread, setNewThread] = useState({ title: '', content: '' });
    const [newThreadFile, setNewThreadFile] = useState<File | null>(null);
    const [comment, setComment] = useState('');
    const [showNewTopicModal, setShowNewTopicModal] = useState(false);

    const currentUser = state.currentUser;
    const isPM = currentUser.roles.includes('PROJECT_MANAGER') || currentUser.roles.includes('ADMIN');

    // Fix #5: Auto-sync Forum Comments
    useEffect(() => {
        if (viewThread && state.forumThreads) {
            const updated = state.forumThreads.find((t: any) => t.id === viewThread.id);
            if (updated && updated.comments.length !== viewThread.comments.length) {
                setViewThread(updated);
            }
        }
    }, [state.forumThreads, viewThread]);

    useEffect(() => {
        localStorage.setItem(`lastRead_${currentUser.id}`, Date.now().toString());
        window.dispatchEvent(new Event('communicationRead'));

        const interval = setInterval(() => {
            if (mode === 'CHAT') fetchChat();
            else fetchForum();
        }, 3000); 
        return () => clearInterval(interval);
    }, [mode, channel]);

    const getAuthToken = () => {
        let token = state.token || state.currentUser?.token;
        if (!token) token = localStorage.getItem('token');
        if (!token) {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                try {
                    const userObj = JSON.parse(userStr);
                    token = userObj.token || userObj.accessToken;
                } catch (e) {}
            }
        }
        if (token && typeof token === 'string' && token.startsWith('"')) token = token.slice(1, -1);
        return token;
    };

    const handleDelete = async (type: 'CHAT' | 'THREAD' | 'COMMENT', id: number) => {
        if (!confirm("Are you sure you want to delete this? It will be removed permanently.")) return;

        const token = getAuthToken();
        const headers: any = { 'Authorization': token };
        let url = '';

        if (type === 'CHAT') url = `http://localhost:3001/api/chat/${id}`;
        else url = `http://localhost:3001/api/forum/${type === 'THREAD' ? 'thread' : 'comment'}/${id}`;

        try {
            const res = await fetch(url, { method: 'DELETE', headers });
            if (!res.ok) throw new Error("Delete failed");
            
            if (type === 'CHAT') fetchChat();
            else {
                fetchForum();
                if (type === 'THREAD') setViewThread(null);
            }
        } catch (err) {
            alert("Could not delete item.");
        }
    };

    const handleChatSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (msg.trim()) {
            sendMessage(msg, channel);
            setMsg('');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'CHAT' | 'FORUM') => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Fix #1: Strict Check for PNG/JPEG
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(file.type)) { 
            alert("Only JPEG and PNG images are allowed.");
            e.target.value = ''; 
            return; 
        }

        const token = getAuthToken();
        if (!token) { alert("Authentication Error: Token missing."); return; }
        
        const formData = new FormData();
        formData.append('image', file); 
        const headers: any = { 'Authorization': token };

        try {
            if (type === 'CHAT') {
                formData.append('senderId', currentUser.id);
                formData.append('senderName', currentUser.name);
                formData.append('senderRole', isPM ? 'PM' : 'MEMBER');
                formData.append('channel', channel);
                formData.append('isImage', 'true');
                formData.append('message', file.name);

                await fetch('http://localhost:3001/api/chat', { method: 'POST', headers, body: formData });
                fetchChat();

            } else if (type === 'FORUM' && viewThread) {
                formData.append('threadId', viewThread.id);
                formData.append('authorId', currentUser.id);
                formData.append('authorName', currentUser.name);
                formData.append('content', file.name); 
                formData.append('isImage', 'true');

                await fetch('http://localhost:3001/api/forum/comment', { method: 'POST', headers, body: formData });
                fetchForum();
                setTimeout(fetchForum, 500); 
            }
        } catch (err: any) {
            alert(`Upload failed: ${err.message}`);
        }
        e.target.value = ''; 
    };

    const handleCreateThread = async () => {
        if (!newThread.title.trim()) return;
        const token = getAuthToken();
        const headers: any = { 'Authorization': token };

        const formData = new FormData();
        formData.append('authorId', currentUser.id);
        formData.append('authorName', currentUser.name);
        formData.append('title', newThread.title);
        
        if (newThreadFile) {
            const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!validTypes.includes(newThreadFile.type)) {
                 alert("Only JPEG and PNG images are allowed."); return;
            }
            formData.append('image', newThreadFile);
            formData.append('isImage', 'true');
            formData.append('content', newThreadFile.name); 
        } else {
            formData.append('content', newThread.content);
            formData.append('isImage', 'false');
        }

        try {
            await fetch('http://localhost:3001/api/forum', { method: 'POST', headers, body: formData });
            setNewThread({ title: '', content: '' });
            setNewThreadFile(null);
            setShowNewTopicModal(false);
            fetchForum();
        } catch (err: any) {
            alert(`Failed to create topic: ${err.message}`);
        }
    };

    const chatMessages = state.chatMessages ? state.chatMessages.filter((m: any) => m.channel === channel) : [];
    const canTypeInChat = channel !== 'Announcements' || isPM;

    return (
        <div className="max-w-5xl mx-auto space-y-4 animate-fadeIn h-[calc(100vh-140px)] flex flex-col relative">
            
            {viewImage && <ImageViewer src={viewImage} onClose={() => setViewImage(null)} />}

            <div className="flex gap-4 mb-2 shrink-0">
                <button onClick={()=>setMode('CHAT')} className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${mode==='CHAT'?'bg-indigo-600 text-white shadow-md':'bg-white text-slate-500 hover:bg-slate-50'}`}>
                    <i className="fas fa-comments mr-2"></i> Team Chat
                </button>
                <button onClick={()=>setMode('FORUM')} className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${mode==='FORUM'?'bg-indigo-600 text-white shadow-md':'bg-white text-slate-500 hover:bg-slate-50'}`}>
                    <i className="fas fa-users mr-2"></i> Discussion Forum
                </button>
            </div>

            {mode === 'CHAT' && (
                <div className="flex flex-col flex-grow bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
                    <div className="flex border-b bg-slate-50">
                        {['General', 'Announcements'].map(c => (
                            <button key={c} onClick={()=>setChannel(c)} className={`px-4 py-3 font-bold text-xs uppercase tracking-wider ${channel===c?'text-indigo-600 border-b-2 border-indigo-600 bg-white':'text-slate-400 hover:text-slate-600'}`}>{c}</button>
                        ))}
                        {currentUser.teamId && (
                             <button onClick={()=>setChannel(`Team-${currentUser.teamId}`)} className={`px-4 py-3 font-bold text-xs uppercase tracking-wider ${channel.startsWith('Team')?'text-indigo-600 border-b-2 border-indigo-600 bg-white':'text-slate-400 hover:text-slate-600'}`}>My Team</button>
                        )}
                    </div>
                    
                    <div className="flex-grow overflow-y-auto p-4 space-y-2 bg-slate-50/50">
                        {chatMessages.length === 0 && <div className="text-center text-slate-400 text-xs mt-10 italic">No messages yet.</div>}
                        {chatMessages.map((m: any) => (
                            // CRASH FIX: Wrap each bubble in an Error Boundary
                            <ErrorBoundary key={m.id}>
                                <ChatBubble 
                                    msg={m} 
                                    isMe={m.senderId === currentUser.id} 
                                    role={m.senderRole || 'MEMBER'} 
                                    onImageClick={setViewImage}
                                    onDelete={(id: number) => handleDelete('CHAT', id)}
                                />
                            </ErrorBoundary>
                        ))}
                    </div>
                    
                    <div className="p-3 bg-white border-t">
                        {canTypeInChat ? (
                            <form onSubmit={handleChatSubmit} className="flex gap-2">
                                <label className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl text-slate-400 cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                    <i className="fas fa-image"></i>
                                    <input type="file" className="hidden" accept="image/png, image/jpeg, image/jpg" onChange={(e) => handleFileUpload(e, 'CHAT')} />
                                </label>
                                <input 
                                    className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" 
                                    placeholder={`Message #${channel}...`} 
                                    value={msg} 
                                    onChange={e=>setMsg(e.target.value)} 
                                />
                                <button className="bg-indigo-600 text-white w-10 h-10 rounded-xl hover:bg-indigo-700 shadow-md transition-transform active:scale-95"><i className="fas fa-paper-plane"></i></button>
                            </form>
                        ) : (
                            <div className="text-center text-xs text-slate-400 bg-slate-50 p-2 rounded-xl italic border border-slate-100">
                                <i className="fas fa-lock mr-2"></i> Only Project Managers can post announcements.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {mode === 'FORUM' && (
                <div className="flex-grow flex flex-col overflow-hidden">
                    {viewThread ? (
                        <div className="flex flex-col h-full bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                                <button onClick={()=>setViewThread(null)} className="text-slate-500 hover:text-indigo-600 text-xs font-bold uppercase tracking-wider">
                                    <i className="fas fa-arrow-left mr-1"></i> Back
                                </button>
                                <h2 className="text-sm font-black text-slate-800 truncate max-w-[70%]">{viewThread.title}</h2>
                            </div>
                            
                            <div className="flex-grow overflow-y-auto p-6 space-y-6">
                                {/* Thread Main Post */}
                                <ErrorBoundary>
                                <div className="pb-6 border-b border-slate-100 relative group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="font-bold text-sm text-indigo-700 block">{viewThread.authorName}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(viewThread.createdAt).toLocaleString()}</span>
                                        </div>
                                        {(isPM || viewThread.authorId === currentUser.id) && (
                                            <button onClick={()=>handleDelete('THREAD', viewThread.id)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fas fa-trash"></i></button>
                                        )}
                                    </div>
                                    
                                    {viewThread.isImage ? (
                                        <div className="mt-2">
                                            <img 
                                                src={viewThread.content.startsWith('data:') ? viewThread.content : `http://localhost:3001${viewThread.content}`}
                                                alt="Attachment" 
                                                className="max-w-full rounded-lg cursor-pointer hover:opacity-95 shadow-sm"
                                                onClick={() => setViewImage(viewThread.content)} 
                                            />
                                        </div>
                                    ) : (
                                        <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{viewThread.content}</p>
                                    )}
                                </div>
                                </ErrorBoundary>

                                <h3 className="font-bold text-slate-400 text-xs uppercase tracking-wider">Replies</h3>
                                {viewThread.comments.map((c: any) => (
                                    <ErrorBoundary key={c.id}>
                                    <div className="flex gap-3 group">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                                            {c.authorName.charAt(0)}
                                        </div>
                                        <div className="flex-grow">
                                            <div className="bg-slate-50 p-3 rounded-xl rounded-tl-none border border-slate-100 relative">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-xs text-slate-700">{c.authorName}</span>
                                                    <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleTimeString()}</span>
                                                </div>
                                                {c.isImage ? (
                                                        <img 
                                                            src={c.content.startsWith('data:') ? c.content : `http://localhost:3001${c.content}`}
                                                            alt="Attachment" 
                                                            className="max-w-[150px] rounded-lg mt-2 cursor-pointer hover:opacity-90"
                                                            onClick={() => setViewImage(c.content)} 
                                                        />
                                                    ) : (
                                                        <p className="text-xs text-slate-600 whitespace-pre-wrap break-words">{c.content}</p>
                                                    )}
                                                
                                                {(isPM || c.authorId === currentUser.id) && (
                                                    <button onClick={()=>handleDelete('COMMENT', c.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-trash text-xs"></i></button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    </ErrorBoundary>
                                ))}
                            </div>

                            <div className="p-3 bg-white border-t flex gap-2 items-center">
                                <label className="text-slate-400 hover:text-indigo-600 cursor-pointer p-2">
                                    <i className="fas fa-image"></i>
                                    <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, 'FORUM')} />
                                </label>
                                <input 
                                    className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500" 
                                    placeholder="Write a reply..." 
                                    value={comment} 
                                    onChange={e=>setComment(e.target.value)} 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && comment.trim()) {
                                            createComment(viewThread.id, comment);
                                            setComment('');
                                            setTimeout(fetchForum, 500);
                                        }
                                    }}
                                />
                                <button onClick={async ()=>{ await createComment(viewThread.id, comment); setComment(''); fetchForum(); }} className="bg-indigo-600 text-white w-10 h-10 rounded-xl hover:bg-indigo-700"><i className="fas fa-paper-plane"></i></button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-grow overflow-y-auto space-y-4">
                            {isPM && (
                                <div className="bg-white p-4 rounded-xl shadow border border-slate-200">
                                    {!showNewTopicModal ? (
                                        <button onClick={()=>setShowNewTopicModal(true)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-bold hover:border-indigo-500 hover:text-indigo-600 text-sm transition-colors">
                                            + Start New Discussion Topic
                                        </button>
                                    ) : (
                                        <div className="space-y-3 animate-fadeIn">
                                            <input className="w-full border rounded-lg px-4 py-2 text-sm font-bold" placeholder="Topic Title" value={newThread.title} onChange={e=>setNewThread({...newThread, title:e.target.value})} />
                                            <textarea className="w-full border rounded-lg px-4 py-2 text-sm" placeholder="What is this about?" rows={2} value={newThread.content} onChange={e=>setNewThread({...newThread, content:e.target.value})} />
                                            
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs font-bold text-slate-500">Attachment (Image):</label>
                                                <input 
                                                    type="file" 
                                                    accept="image/png, image/jpeg"
                                                    className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                                    onChange={(e) => setNewThreadFile(e.target.files?.[0] || null)}
                                                />
                                            </div>

                                            <div className="flex gap-2 justify-end">
                                                <button onClick={()=>setShowNewTopicModal(false)} className="px-3 py-1 text-slate-500 text-xs font-bold">Cancel</button>
                                                <button onClick={handleCreateThread} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-xs">Post Topic</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {state.forumThreads.map((t: any) => (
                                <div key={t.id} onClick={()=>setViewThread(t)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-indigo-400 cursor-pointer transition-all group">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-slate-800 group-hover:text-indigo-700 text-sm">{t.title}</h4>
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full">{t.comments.length} replies</span>
                                    </div>
                                    <div className="flex justify-between mt-2 text-xs text-slate-400">
                                        <span>Started by {t.authorName}</span>
                                        <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
export default CommunicationHub;