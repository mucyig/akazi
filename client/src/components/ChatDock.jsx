import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, ArrowLeft, Lock, Clock } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const initials = (n = '?') => n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const shortWhen = (iso) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? time(iso) : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
const seenText = (o, tr) => {
  if (o.online) return tr('Online now', 'Ari kuri murandasi');
  if (!o.last_seen) return tr('Offline', 'Ntari kuri murandasi');
  const m = Math.max(1, Math.round((Date.now() - new Date(o.last_seen)) / 60000));
  return m < 60 ? tr(`Last seen ${m} min ago`, `Yagaragaye hashize iminota ${m}`) : tr(`Last seen ${shortWhen(o.last_seen)}`, `Yagaragaye ${shortWhen(o.last_seen)}`);
};

function Avatar({ name, online, size = 'w-11 h-11' }) {
  return (
    <div className="relative shrink-0">
      <div className={`${size} rounded-full bg-blue-100 text-blue-800 grid place-items-center text-sm font-bold`}>{initials(name)}</div>
      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${online ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
    </div>
  );
}

const SERVER_RW = {
  'Please wait for the employer to start the conversation.': 'Tegereza ko umukoresha atangiza ikiganiro.',
  'Messaging is closed because this application was not approved.': 'Ubutumwa bwarafunzwe kuko ubusabe butemewe.',
  'Message cannot be empty.': 'Ubutumwa ntibushobora kuba ubusa.',
  'Message is too long (2000 characters max).': 'Ubutumwa ni burebure cyane (inyuguti 2000 ntarengwa).',
  'Conversation not found.': 'Ikiganiro nticyabonetse.',
};
const STARTERS = {
  employer: [['Congratulations! We were impressed by your application and would like to discuss the next steps.', 'Turabashimiye! Ubusabe bwawe bwaradushimishije kandi turashaka kuganira ku ntambwe ikurikira.'], ['Hello, thank you for applying. Are you available for a short call this week?', 'Muraho, urakoze gusaba akazi. Wabona umwanya wo kuvugana kuri telefoni muri iki cyumweru?']],
  employee: [['Thank you, I am very happy to hear from you!', 'Murakoze, nishimiye cyane kubona ubutumwa bwanyu!'], ['Yes, I am available. What time works for you?', 'Yego, ndahari. Ni saa ngahe mwabonera umwanya?']],
};

function Thread() {
  const { tr } = useLanguage();
  const { thread, send, backToList, error } = useChat();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const c = thread.conversation;

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread.messages.length, c?.application_id]);

  const submit = async (body) => {
    const v = (body ?? text).trim();
    if (!v || busy) return;
    setBusy(true);
    try { await send(v); setText(''); } catch (e) { /* error shown from context */ } finally { setBusy(false); }
  };

  if (!c) return <div className="flex-1 grid place-items-center text-sm text-zinc-500">{tr(tr("Loading conversation…", "Ikiganiro kiraje…"), "Ikiganiro kiraje…")}</div>;
  const chips = c.can_send && thread.messages.length === 0 ? STARTERS[c.my_role].map(([en, rw]) => tr(en, rw)) : [];

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 bg-white">
        <button onClick={backToList} className="p-2 -ml-2 rounded-lg hover:bg-zinc-100" aria-label={tr(tr("Back to conversations", "Subira ku biganiro"), "Subira ku biganiro")}><ArrowLeft className="w-5 h-5" /></button>
        <Avatar name={c.other.name} online={c.other.online} />
        <div className="min-w-0">
          <p className="font-semibold text-zinc-950 truncate">{c.other.name}</p>
          <p className={`text-xs truncate ${c.other.online ? 'text-emerald-600 font-medium' : 'text-zinc-500'}`}>{seenText(c.other, tr)} · {c.job_title}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-[#f4f6f3]">
        {thread.messages.length === 0 && (
          <div className="text-center text-sm text-zinc-500 mt-10 px-6">
            {c.waiting_for_employer
              ? <><Clock className="w-6 h-6 mx-auto mb-2 text-zinc-400" />{tr('You’ve been approved! ' + c.other.name + ' will start the conversation. You’ll be able to reply once they do.', 'Wemewe! ' + c.other.name + ' ni we uzatangiza ikiganiro. Uzabasha gusubiza ubwo yamaze kwandika.')}</>
              : c.can_send ? tr("Say hello to start the conversation.", "Muramukize utangize ikiganiro.") : tr("No messages.", "Nta butumwa.")}
          </div>
        )}
        {thread.messages.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${mine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-zinc-900 border border-zinc-200 rounded-bl-md'}`}>
                {m.body}
                <span className={`block text-[10px] mt-1 text-right ${mine ? 'text-blue-100' : 'text-zinc-400'}`}>{time(m.created_at)}{mine && m.read_at ? ' · ' + tr('Seen', 'Yarabonywe') : ''}</span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {c.locked ? (
        <div className="p-4 border-t border-zinc-200 bg-white text-sm text-zinc-600 flex items-center gap-2"><Lock className="w-4 h-4 shrink-0" />{tr('Messaging is closed because this application was declined.','Ubutumwa bwarafunzwe kuko ubusabe bwanzwe.')}</div>
      ) : c.waiting_for_employer ? (
        <div className="p-4 border-t border-zinc-200 bg-white text-sm text-zinc-600 flex items-center gap-2"><Lock className="w-4 h-4 shrink-0" />{tr('Waiting for the employer to message you first.','Tegereza ko umukoresha ari we ukwandikira mbere.')}</div>
      ) : (
        <div className="p-3 border-t border-zinc-200 bg-white">
          {error && <p className="text-xs text-red-600 mb-2">{tr(error, SERVER_RW[error])}</p>}
          {chips.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {chips.map((s) => (
                <button key={s} onClick={() => submit(s)} className="shrink-0 max-w-[260px] text-left text-xs px-3 py-1.5 rounded-full border border-blue-200 text-blue-800 bg-blue-50 hover:bg-blue-100 truncate">{s}</button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={text} rows={1} maxLength={2000} placeholder={tr(tr("Write a message…", "Andika ubutumwa…"), "Andika ubutumwa…")}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              className="flex-1 resize-none max-h-28 px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:border-blue-600 focus:outline-none"
            />
            <button onClick={() => submit()} disabled={!text.trim() || busy} className="p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40" aria-label={tr(tr("Send", "Ohereza"), "Ohereza")}><Send className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </>
  );
}

function List() {
  const { tr } = useLanguage();
  const { conversations, selectConversation } = useChat();
  if (conversations.length === 0) {
    return (
      <div className="flex-1 grid place-items-center text-center px-8 text-sm text-zinc-500">
        <div><MessageCircle className="w-9 h-9 mx-auto mb-3 text-zinc-300" />{tr('No conversations yet. Chats open here once an employer approves an application.','Nta biganiro biraba. Ibiganiro bifungurirwa hano umukoresha amaze kwemera ubusabe.')}</div>
      </div>
    );
  }
  return (
    <ul className="flex-1 overflow-y-auto divide-y divide-zinc-100">
      {conversations.map((c) => (
        <li key={c.application_id}>
          <button onClick={() => selectConversation(c.application_id)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-zinc-50">
            <Avatar name={c.other.name} online={c.other.online} />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2">
                <p className="font-semibold text-sm text-zinc-950 truncate">{c.other.name}</p>
                {c.last_message && <span className="text-[11px] text-zinc-400 shrink-0">{shortWhen(c.last_message.created_at)}</span>}
              </div>
              <p className="text-xs text-zinc-500 truncate">{c.job_title}</p>
              <p className={`text-xs truncate mt-0.5 ${c.unread ? 'text-zinc-900 font-semibold' : 'text-zinc-500'}`}>
                {c.locked ? tr("Closed", "Cyarafunzwe") : c.last_message ? `${c.last_message.mine ? tr("You: ", "Wowe: ") : ''}${c.last_message.body}` : c.waiting_for_employer ? tr("Waiting for employer to start", "Hategerejwe ko umukoresha atangiza") : tr("Start the conversation", "Tangiza ikiganiro")}
              </p>
            </div>
            {c.unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold grid place-items-center">{c.unread}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function ChatDock() {
  const { tr } = useLanguage();
  const { enabled, open, openChat, closeChat, unreadTotal, activeId } = useChat();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeChat();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeChat]);
  if (!enabled) return null;

  return (
    <>
      {!open && (
        <button onClick={() => openChat()} aria-label={tr(tr("Open messages", "Fungura ubutumwa"), "Fungura ubutumwa")}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-blue-700 text-white font-semibold text-sm shadow-lg hover:bg-blue-800 transition">
          <MessageCircle className="w-5 h-5" />{tr("Messages", "Ubutumwa")}
          {unreadTotal > 0 && <span className="ml-1 min-w-5 h-5 px-1.5 rounded-full bg-amber-400 text-zinc-900 text-[11px] font-bold grid place-items-center">{unreadTotal}</span>}
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-zinc-950/30" onClick={closeChat} />
          <aside className="anim-slide-in absolute right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl flex flex-col" role="dialog" aria-label={tr(tr("Messages", "Ubutumwa"), "Ubutumwa")}>
            {!activeId && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
                <h2 className="text-lg font-bold text-zinc-950">{tr(tr("Messages", "Ubutumwa"), "Ubutumwa")}</h2>
                <button onClick={closeChat} className="p-2 rounded-lg hover:bg-zinc-100" aria-label={tr(tr("Close", "Funga"), "Funga")}><X className="w-5 h-5" /></button>
              </div>
            )}
            {activeId ? <Thread /> : <List />}
            {activeId && <button onClick={closeChat} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-zinc-100" aria-label={tr(tr("Close", "Funga"), "Funga")}><X className="w-5 h-5" /></button>}
          </aside>
        </div>
      )}
    </>
  );
}

export function MessageButton({ appId, status }) {
  const { tr } = useLanguage();
  const { openChat } = useChat();
  const isEmployer = useAuth().user?.role === "employer";
  if (status !== 'approved') return null;
  return (
    <button onClick={() => openChat(appId)} className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">
      <MessageCircle className="w-4 h-4" />{isEmployer ? tr("Message candidate", "Andikira umukandida") : tr("Open chat", "Fungura ikiganiro")}
    </button>
  );
}
