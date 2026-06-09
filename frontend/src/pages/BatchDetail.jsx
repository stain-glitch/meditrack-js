import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";
import api from "../api";
import { useAuth } from "../hooks/useAuth";
import { Card, StatusBadge, Button, Modal, Input, Textarea, Spinner, Badge, PageHeader } from "../components/Components";
import styles from "./BatchDetail.module.css";

const EVT_COLORS = { REGISTERED:"blue", TRANSFERRED:"amber", RECEIVED:"green", DISCREPANCY:"red", FLAGGED:"red", DISPENSED:"default" };

function ChainMismatchPanel({ verif, batchId, onAcknowledge }) {
  const { user } = useAuth();
  const [expanded,    setExpanded]    = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [notes,       setNotes]       = useState("");
  const [error,       setError]       = useState(null);
  const [done,        setDone]        = useState(false);

  const isCMST = user?.role === "CMST";

  async function handleAcknowledge() {
    setAcknowledging(true); setError(null);
    try {
      await api.post(`/batches/${batchId}/acknowledge-mismatch`, {
        reason: verif?.reason || "Hash mismatch detected",
        notes: notes || "",
        acknowledgedBy: user?.name || user?.wallet,
      });
      setDone(true);
      onAcknowledge();
    } catch (err) { setError(err.response?.data?.error || "Failed to acknowledge"); }
    finally { setAcknowledging(false); }
  }

  if (done) return (
    <div className={styles.chainVerified}>
      <span className={styles.chainDot} />
      Mismatch acknowledged and logged
    </div>
  );

  return (
    <div className={styles.mismatchPanel}>
      <div className={styles.mismatchHeader}>
        <span className={styles.chainDotRed} />
        <span className={styles.mismatchTitle}>Chain verification failed</span>
      </div>
      <p className={styles.mismatchReason}>{verif?.reason || "Hash mismatch — record may have been altered"}</p>

      <p className={styles.mismatchExplain}>
        This can happen when records were migrated, the system was updated, or data was re-seeded.
        If this batch's provenance is known to be valid, an admin can acknowledge and log the mismatch
        to clear the warning.
      </p>

      {isCMST && !expanded && (
        <button className={styles.mismatchExpandBtn} onClick={() => setExpanded(true)}>
          Acknowledge mismatch →
        </button>
      )}

      {isCMST && expanded && (
        <div className={styles.mismatchForm}>
          <textarea
            className={styles.mismatchNotes}
            placeholder="Optional: notes on why this mismatch is expected (e.g. system migration, data reseed)..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
          />
          {error && <p className={styles.mismatchError}>{error}</p>}
          <div className={styles.mismatchActions}>
            <button className={styles.mismatchCancelBtn} onClick={() => setExpanded(false)}>Cancel</button>
            <button className={styles.mismatchConfirmBtn} onClick={handleAcknowledge} disabled={acknowledging}>
              {acknowledging ? "Logging…" : "Confirm acknowledgement"}
            </button>
          </div>
          <p className={styles.mismatchWarning}>
            ⚠ Only acknowledge if you have verified this batch through other means.
            This action is logged to the chain.
          </p>
        </div>
      )}

      {!isCMST && (
        <p className={styles.mismatchAdminNote}>Contact a CMST admin to review and acknowledge this alert.</p>
      )}
    </div>
  );
}


const ACTION_CONFIGS = {
  transfer: { title:"Log transfer out",    fields:[{ k:"quantity",          label:"Quantity dispatched",  type:"number",   ph:"1000" },{ k:"toLocation",      label:"Destination facility", type:"text",     ph:"Mzuzu DHO" },{ k:"notes",           label:"Notes",               type:"textarea", ph:"Transporter, vehicle, etc." }] },
  receive:  { title:"Log receipt",         fields:[{ k:"quantityExpected",  label:"Quantity expected",    type:"number",   ph:"1000" },{ k:"quantityReceived",label:"Quantity received",    type:"number",   ph:"1000" },{ k:"location",        label:"Your facility",        type:"text",     ph:"Lilongwe HC" },{ k:"notes",           label:"Notes",               type:"textarea", ph:"Condition on arrival, etc." }] },
  dispense: { title:"Log dispensing",      fields:[{ k:"quantity",          label:"Units dispensed",      type:"number",   ph:"50" },{ k:"location",          label:"Facility / ward",      type:"text",     ph:"Outpatient ward" },{ k:"notes",           label:"Notes",               type:"textarea", ph:"Patient group, programme, etc." }] },
  flag:     { title:"Flag batch",          fields:[{ k:"reason",            label:"Reason",               type:"textarea", ph:"Suspected diversion / broken seal" },{ k:"location",        label:"Current location",     type:"text",     ph:"Where is the batch now?" }] },
};

function ActionModal({ open, onClose, onSuccess, batchId, action }) {
  const [form, setForm]       = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const cfg = ACTION_CONFIGS[action] || {};
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    const payload = { ...form };
    ["quantity","quantityReceived","quantityExpected"].forEach(k => { if (payload[k] !== undefined) payload[k] = Number(payload[k]); });
    try {
      await api.post(`/batches/${batchId}/${action}`, payload);
      onSuccess(); onClose(); setForm({});
    } catch (err) { setError(err.response?.data?.error || "Action failed"); }
    finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={cfg.title || ""}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {cfg.fields?.map(f =>
          f.type === "textarea"
            ? <Textarea key={f.k} label={f.label} value={form[f.k]||""} onChange={set(f.k)} placeholder={f.ph} />
            : <Input    key={f.k} label={f.label} type={f.type} value={form[f.k]||""} onChange={set(f.k)} placeholder={f.ph} />
        )}
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.formActions}>
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={loading}>{cfg.title}</Button>
        </div>
      </form>
    </Modal>
  );
}

function QRModal({ open, onClose, batch }) {
  const [dataUrl, setDataUrl] = useState(null);
  useEffect(() => {
    if (!open || !batch) return;
    const payload = JSON.stringify({ batchId: batch.batchId, medicine: batch.medicineName, manufacturer: batch.manufacturer, status: batch.status });
    QRCode.toDataURL(payload, { width:280, margin:2, color:{ dark:"#1a1916", light:"#ffffff" } }).then(setDataUrl);
  }, [open, batch]);

  function printLabel() {
    if (!dataUrl || !batch) return;
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>QR — ${batch.batchId}</title>
    <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;padding:32px;color:#1a1916}img{width:200px;height:200px}h2{margin:12px 0 4px;font-size:18px;font-weight:500}p{margin:2px 0;font-size:12px;color:#6b6960}@media print{body{padding:10px}}</style>
    </head><body><img src="${dataUrl}"/><h2>${batch.batchId}</h2><p>${batch.medicineName}</p><p>${batch.manufacturer}</p>
    <script>window.onload=()=>window.print();</script></body></html>`);
    win.document.close();
  }

  if (!batch) return null;
  return (
    <Modal open={open} onClose={onClose} title={`QR — ${batch.batchId}`} width={360}>
      <div className={styles.qrBody}>
        {dataUrl ? <img src={dataUrl} alt="QR" className={styles.qrImage} /> : <div className={styles.qrPlaceholder}><Spinner size="lg" color="accent" /></div>}
        <div className={styles.qrInfo}><span className={styles.qrMed}>{batch.medicineName}</span><span className={styles.qrMfr}>{batch.manufacturer}</span></div>
        <p className={styles.qrNote}>Scan with the MediTrack mobile app to verify provenance.</p>
        <div className={styles.qrActions}><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={printLabel} disabled={!dataUrl}>Print label</Button></div>
      </div>
    </Modal>
  );
}

function TransitModal({ open, onClose, batch }) {
  if (!batch) return null;
  const MOVE = ["TRANSFERRED","RECEIVED","DISCREPANCY","DISPENSED"];
  const events = (batch.history||[]).filter(e => MOVE.includes(e.eventType));
  const fmtDate = ts => ts ? new Date(ts*1000).toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";

  const entries = [];
  for (let i = 0; i < events.length; i++) {
    const evt = events[i];
    if (evt.eventType === "TRANSFERRED") {
      const next = events[i+1];
      const hasR = next && ["RECEIVED","DISCREPANCY"].includes(next.eventType);
      entries.push({ type:"transfer", dispatch:evt, receipt: hasR ? next : null });
      if (hasR) i++;
    } else if (evt.eventType === "DISPENSED") {
      entries.push({ type:"dispense", event:evt });
    } else if (["RECEIVED","DISCREPANCY"].includes(evt.eventType)) {
      entries.push({ type:"transfer", dispatch:null, receipt:evt });
    }
  }

  const tc = entries.filter(e=>e.type==="transfer").length;
  const dc = entries.filter(e=>e.type==="dispense").length;
  const disc = entries.filter(e=>e.receipt?.eventType==="DISCREPANCY").length;

  return (
    <Modal open={open} onClose={onClose} title={`Movement history — ${batch.batchId}`} width={580}>
      {entries.length === 0 ? <p className={styles.empty}>No movement events yet.</p> : (
        <div className={styles.transitList}>
          {entries.map((entry, i) => {
            if (entry.type === "dispense") {
              const e = entry.event;
              return (
                <div key={i} className={styles.transitLeg}>
                  <div className={styles.legHeader}><span className={styles.legNum}>Dispense</span><Badge type="default">Dispensed</Badge></div>
                  <div className={styles.legRow}>
                    <div className={styles.legDotGray} />
                    <div className={styles.legContent}>
                      <span className={styles.legActor}>{e.actorName}</span>
                      {e.location && <span className={styles.legLoc}>{e.location}</span>}
                      <span className={styles.legQty}>{e.quantity.toLocaleString()} units</span>
                      <span className={styles.legTime}>{fmtDate(e.timestamp)}</span>
                      {e.notes && <span className={styles.legNotes}>{e.notes}</span>}
                      <span className={`mono ${styles.legHash}`}>{e.hash?.slice(0,20)}…</span>
                    </div>
                  </div>
                </div>
              );
            }
            const leg    = entry;
            const legNum = entries.slice(0,i).filter(e=>e.type==="transfer").length+1;
            return (
              <div key={i} className={styles.transitLeg}>
                <div className={styles.legHeader}>
                  <span className={styles.legNum}>Leg {legNum}</span>
                  {leg.receipt?.eventType==="DISCREPANCY" ? <Badge type="red">Discrepancy</Badge> : leg.receipt ? <Badge type="green">Completed</Badge> : <Badge type="amber">In Transit</Badge>}
                </div>
                {leg.dispatch && (
                  <div className={styles.legRow}>
                    <div className={styles.legDotAmber} />
                    <div className={styles.legContent}>
                      <span className={styles.legActor}>{leg.dispatch.actorName}</span>
                      {leg.dispatch.location && <span className={styles.legLoc}>{leg.dispatch.location}</span>}
                      <span className={styles.legQty}>{leg.dispatch.quantity.toLocaleString()} units dispatched</span>
                      <span className={styles.legTime}>{fmtDate(leg.dispatch.timestamp)}</span>
                      {leg.dispatch.notes && <span className={styles.legNotes}>{leg.dispatch.notes}</span>}
                      <span className={`mono ${styles.legHash}`}>{leg.dispatch.hash?.slice(0,20)}…</span>
                    </div>
                  </div>
                )}
                {leg.dispatch && <div className={styles.legArrow}><div className={styles.legLine}/><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 5h8M5 1l4 4-4 4" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>}
                {leg.receipt ? (
                  <div className={styles.legRow}>
                    <div className={leg.receipt.eventType==="DISCREPANCY" ? styles.legDotRed : styles.legDotGreen} />
                    <div className={styles.legContent}>
                      <span className={styles.legActor}>{leg.receipt.actorName}</span>
                      {leg.receipt.location && <span className={styles.legLoc}>{leg.receipt.location}</span>}
                      <span className={leg.receipt.eventType==="DISCREPANCY" ? styles.legQtyWarn : styles.legQty}>
                        {leg.receipt.quantity.toLocaleString()} units received
                        {leg.receipt.eventType==="DISCREPANCY" && leg.dispatch && ` (${leg.dispatch.quantity-leg.receipt.quantity} missing)`}
                      </span>
                      <span className={styles.legTime}>{fmtDate(leg.receipt.timestamp)}</span>
                      {leg.receipt.notes && <span className={styles.legNotes}>{leg.receipt.notes}</span>}
                      <span className={`mono ${styles.legHash}`}>{leg.receipt.hash?.slice(0,20)}…</span>
                    </div>
                  </div>
                ) : leg.dispatch ? (
                  <div className={styles.legPending}><span className={styles.legDotPulse}/>Awaiting receipt confirmation</div>
                ) : null}
              </div>
            );
          })}
          <div className={styles.transitSummary}><span>Transfer legs: {tc}</span><span>Dispenses: {dc}</span><span>Discrepancies: {disc}</span></div>
        </div>
      )}
    </Modal>
  );
}

function printAuditReport(batch, verif) {
  if (!batch) return;
  const fmt = ts => ts ? new Date(ts*1000).toLocaleString("en-GB") : "—";
  const anomalies = (batch.history||[]).filter(e => ["DISCREPANCY","FLAGGED"].includes(e.eventType));
  const vBadge = verif?.valid
    ? `<span style="color:#0f4a32;background:#e8f4ee;padding:3px 10px;border-radius:99px;font-size:12px">Chain intact</span>`
    : `<span style="color:#a02020;background:#fde8e8;padding:3px 10px;border-radius:99px;font-size:12px">Chain tampered</span>`;

  const win = window.open("","_blank");
  win.document.write(`<!DOCTYPE html><html><head><title>Audit — ${batch.batchId}</title>
  <style>body{font-family:sans-serif;padding:40px;color:#1a1916;max-width:800px;margin:0 auto}h1{font-size:22px;font-weight:500;margin-bottom:4px}h2{font-size:13px;font-weight:500;margin:22px 0 9px;text-transform:uppercase;letter-spacing:.05em;color:#6b6960}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;padding:7px 10px;background:#f5f4f0;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9c9a92;border-bottom:1px solid #e4e2db}td{padding:8px 10px;border-bottom:1px solid #e4e2db;vertical-align:top}.mono{font-family:monospace;font-size:11px;color:#6b6960;word-break:break-all}.meta{display:flex;gap:24px;margin:10px 0 22px;font-size:13px;color:#6b6960}.meta b{color:#1a1916}.warn{background:#fde8e8;padding:9px 13px;border-radius:6px;font-size:12px;color:#a02020;margin-bottom:6px}.footer{margin-top:32px;padding-top:14px;border-top:1px solid #e4e2db;font-size:11px;color:#9c9a92}@media print{body{padding:20px}}</style>
  </head><body>
  <h1>Audit Report — ${batch.batchId}</h1>
  <div style="margin-bottom:8px">${vBadge}</div>
  <div class="meta">
    <span><b>Medicine</b><br>${batch.medicineName}</span>
    <span><b>Manufacturer</b><br>${batch.manufacturer}</span>
    <span><b>Status</b><br>${batch.status}</span>
    <span><b>Units remaining</b><br>${batch.remainingQuantity} / ${batch.quantity}</span>
    <span><b>Expiry</b><br>${batch.expiryDate ? new Date(batch.expiryDate*1000).toLocaleDateString("en-GB") : "—"}</span>
  </div>
  ${anomalies.length ? `<h2>Anomalies (${anomalies.length})</h2>${anomalies.map(e=>`<div class="warn">${e.eventType} · ${e.actorName} · ${e.notes||""} · ${fmt(e.timestamp)}</div>`).join("")}` : ""}
  <h2>Chain verification</h2>
  <p style="font-size:13px;margin-bottom:14px">${verif?.message || (verif?.valid ? "All blocks verified" : verif?.reason || "")}</p>
  <h2>Full provenance (${batch.history?.length||0} blocks)</h2>
  <table><thead><tr><th>Block hash</th><th>Event</th><th>Actor</th><th>Location</th><th>Units</th><th>Timestamp</th></tr></thead>
  <tbody>${(batch.history||[]).map(e=>`<tr><td class="mono">${e.hash?.slice(0,18)}…</td><td>${e.eventType}</td><td>${e.actorName}</td><td>${e.location||"—"}</td><td>${e.quantity>0?e.quantity.toLocaleString():"—"}</td><td>${fmt(e.timestamp)}</td></tr>`).join("")}</tbody></table>
  <div class="footer">Generated ${new Date().toLocaleString("en-GB")} · MediTrack JS Blockchain · SHA-256 linked blocks</div>
  <script>window.onload=()=>window.print();</script></body></html>`);
  win.document.close();
}

export default function BatchDetail() {
  const { id }                       = useParams();
  const [batch,        setBatch]     = useState(null);
  const [verif,        setVerif]     = useState(null);
  const [loading,      setLoading]   = useState(true);
  const [modal,        setModal]     = useState(null);
  const [showQR,       setShowQR]    = useState(false);
  const [showTransit,  setShowTransit] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get(`/batches/${id}`);
      setBatch(r.data.batch);
      setVerif(r.data.chainVerification);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className={styles.loading}><Spinner size="lg" color="accent" /></div>;
  if (!batch)  return <p style={{ color:"var(--red)" }}>Batch not found.</p>;

  const fmtDate = ts => ts ? new Date(ts*1000).toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
  const fillPct = Math.round((batch.remainingQuantity / Math.max(batch.quantity,1)) * 100);
  const isExpiringSoon = batch.expiryDate && batch.expiryDate*1000 < Date.now() + 30*86400000;
  const transitCount   = (batch.history||[]).filter(e=>["TRANSFERRED","RECEIVED","DISCREPANCY","DISPENSED"].includes(e.eventType)).length;
  const chainOk        = verif?.valid !== false;

  return (
    <div>
      {/* Action bar */}
      <div className={styles.actionBar}>
        <span className={styles.actionBarLabel}>Log event</span>
        <Button variant="secondary" size="sm" onClick={() => setModal("transfer")}>Transfer out</Button>
        <Button variant="secondary" size="sm" onClick={() => setModal("receive")}>Log receipt</Button>
        <Button variant="secondary" size="sm" onClick={() => setModal("dispense")}>Log dispensing</Button>
        <Button variant="danger"    size="sm" onClick={() => setModal("flag")}>Flag</Button>
        <div style={{ flex:1 }} />
        <Button variant="ghost" size="sm" onClick={() => setShowQR(true)}>QR code</Button>
        <Button variant="ghost" size="sm" onClick={() => setShowTransit(true)}>
          Movement history {transitCount > 0 && <span className={styles.countPill}>{transitCount}</span>}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => printAuditReport(batch, verif)}>Print report</Button>
      </div>

      <PageHeader title={batch.batchId} subtitle={`${batch.medicineName} · ${batch.manufacturer}`} />

      <div className={styles.topRow}>
        <Card className={styles.infoCard}>
          <p className={styles.sectionLabel}>Batch details</p>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Status</span><StatusBadge status={batch.status} /></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Units remaining</span><span className="mono">{batch.remainingQuantity.toLocaleString()} / {batch.quantity.toLocaleString()}</span></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Expiry date</span><span className={`mono ${isExpiringSoon ? styles.warn : ""}`}>{batch.expiryDate ? new Date(batch.expiryDate*1000).toLocaleDateString("en-GB") : "—"}</span></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Registered</span><span className="mono">{fmtDate(batch.createdAt)}</span></div>
            <div className={styles.infoItem} style={{ gridColumn:"1/-1" }}><span className={styles.infoLabel}>Registered by</span><span className={`mono ${styles.address}`}>{batch.registeredBy}</span></div>
          </div>
          <div className={styles.fillRow}><span className={styles.fillLabel}>Stock level</span><span className={`mono ${styles.fillPct}`}>{fillPct}%</span></div>
          <div className={styles.fillBar}><div className={styles.fillFill} style={{ width:fillPct+"%", background: fillPct<20?"var(--red)":fillPct<50?"var(--amber)":"var(--accent)" }}/></div>
        </Card>

        <Card className={styles.chainCard}>
          <p className={styles.sectionLabel}>Blockchain record</p>
          {chainOk ? (
            <div className={styles.chainVerified}>
              <span className={styles.chainDot} />
              Chain intact — tamper-evident
            </div>
          ) : (
            <ChainMismatchPanel verif={verif} batchId={batch.batchId} onAcknowledge={load} />
          )}
          {[["Total blocks", batch.history?.length||0],["Transfer legs",(batch.history||[]).filter(e=>e.eventType==="TRANSFERRED").length],["Dispenses",(batch.history||[]).filter(e=>e.eventType==="DISPENSED").length],["Discrepancies",(batch.history||[]).filter(e=>e.eventType==="DISCREPANCY").length]].map(([label,val])=>(
            <div key={label} className={styles.chainMeta}><span className={styles.infoLabel}>{label}</span><span className="mono">{val}</span></div>
          ))}
          <div className={styles.chainMeta} style={{ alignItems:"flex-start" }}>
            <span className={styles.infoLabel}>Latest block</span>
            <span className="mono" style={{ fontSize:".7rem", wordBreak:"break-all" }}>
              {batch.history?.length ? batch.history[batch.history.length-1].hash?.slice(0,32)+"…" : "—"}
            </span>
          </div>
          <p className={styles.chainNote}>SHA-256 linked blocks. Any alteration breaks the chain and is detected on every read.</p>
          <Button variant="secondary" size="sm" className={styles.printBtn} onClick={() => printAuditReport(batch, verif)}>Print audit report</Button>
        </Card>
      </div>

      <Card>
        <p className={styles.sectionLabel} style={{ marginBottom:20 }}>Provenance timeline</p>
        {!batch.history?.length ? <p className={styles.empty}>No events recorded yet.</p> : (
          <div className={styles.timeline}>
            {batch.history.map((evt, i) => (
              <div key={i} className={styles.timelineItem}>
                <div className={styles.timelineLeft}>
                  <div className={`${styles.timelineDot} ${styles["dot_"+(EVT_COLORS[evt.eventType]||"default")]}`} />
                  {i < batch.history.length-1 && <div className={styles.timelineLine}/>}
                </div>
                <div className={styles.timelineContent}>
                  <div className={styles.timelineHeader}>
                    <Badge type={EVT_COLORS[evt.eventType]||"default"}>{evt.eventType}</Badge>
                    <span className={styles.timelineActor}>{evt.actorName}</span>
                    <span className={styles.timelineTime}>{fmtDate(evt.timestamp)}</span>
                  </div>
                  <div className={styles.timelineMeta}>
                    {evt.location && <span>{evt.location}</span>}
                    {evt.quantity>0 && <><span className={styles.sep}>·</span><span className="mono">{evt.quantity.toLocaleString()} units</span></>}
                  </div>
                  {evt.notes && <p className={styles.timelineNotes}>{evt.notes}</p>}
                  <p className={`mono ${styles.blockHash}`} title={evt.hash}>{evt.hash?.slice(0,24)}…</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ActionModal open={!!modal} onClose={()=>setModal(null)} onSuccess={load} batchId={id} action={modal}/>
      <QRModal     open={showQR} onClose={()=>setShowQR(false)} batch={batch}/>
      <TransitModal open={showTransit} onClose={()=>setShowTransit(false)} batch={batch}/>
    </div>
  );
}
