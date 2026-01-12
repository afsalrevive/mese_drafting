import React from 'react';

const NotificationPanel = ({ notifications, onClose, onClear, onMarkRead }) => {
    // Show unread first, then by date
    const sorted = [...notifications].sort((a,b) => (a.isRead === b.isRead) ? 0 : a.isRead ? 1 : -1);

    return (
        <div className="absolute top-16 right-4 w-80 bg-white shadow-2xl rounded-xl border border-slate-200 overflow-hidden z-[100] animate-fadeIn">
            <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center">
                <h3 className="font-bold text-sm">Notifications</h3>
                <div className="flex gap-2">
                     <button onClick={onMarkRead} className="text-[10px] bg-slate-700 px-2 py-1 rounded hover:bg-slate-600">Mark Read</button>
                     <button onClick={onClose}><i className="fas fa-times"></i></button>
                </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {sorted.length === 0 ? <p className="p-4 text-center text-slate-400 text-xs">No notifications</p> : 
                    sorted.map(n => (
                        <div key={n.id} className={`p-3 text-xs ${n.isRead ? 'bg-white text-slate-400' : 'bg-indigo-50 text-slate-800 font-medium'}`}>
                            {n.message}
                            <div className="text-[10px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                        </div>
                    ))
                }
            </div>
            {notifications.length > 0 && (
                <div className="bg-slate-50 p-2 text-center border-t border-slate-200">
                    <button onClick={onClear} className="text-red-500 text-xs font-bold hover:underline">Clear History</button>
                </div>
            )}
        </div>
    );
};
export default NotificationPanel;