import { useState } from "react";
import { useGame } from "../../state/GameContext";
import { CPU_DAMS, CPU_SIRES, getCpuHorse } from "../../data/cpuHorses";
import { pairSpread } from "../../domain/breeding";
import type { InheritType, ParentRef } from "../../domain/types";
import type { View } from "../nav";

interface ParentInfo {
  name: string;
  inheritType: InheritType;
  growth: string;
  distance: string;
  dirtApt: string;
  temper: string;
  coat: string;
}

function refToValue(ref: ParentRef): string {
  return ref.kind === "none" ? "none" : `${ref.kind}:${ref.id}`;
}
function valueToRef(v: string): ParentRef {
  if (v === "none") return { kind: "none" };
  const [kind, id] = v.split(":");
  return { kind: kind as "cpu" | "owned", id };
}

export function BreedPlanner({ go }: { go: (v: View) => void }) {
  const { horses } = useGame();
  const [sire, setSire] = useState<ParentRef>({ kind: "none" });
  const [dam, setDam] = useState<ParentRef>({ kind: "none" });

  function resolve(ref: ParentRef): ParentInfo | null {
    if (ref.kind === "none") return null;
    if (ref.kind === "cpu") {
      const c = getCpuHorse(ref.id);
      if (!c) return null;
      return { name: c.name, inheritType: c.inheritType, growth: c.growth, distance: c.distance, dirtApt: c.dirtApt, temper: c.temper, coat: c.coat };
    }
    const h = horses.find((x) => x.id === ref.id);
    if (!h) return null;
    return { name: h.name, inheritType: h.inheritType, growth: h.growth, distance: h.distance, dirtApt: h.dirtApt, temper: h.temper, coat: h.coat };
  }

  const sireInfo = resolve(sire);
  const damInfo = resolve(dam);
  const spread =
    sireInfo && damInfo ? pairSpread(sireInfo.inheritType, damInfo.inheritType) : null;

  // 牡=種牡馬候補（CPU種牡馬＋牡の所有馬）、牝=繁殖牝馬候補。
  const ownedSires = horses.filter((h) => h.sex !== "牝");
  const ownedDams = horses.filter((h) => h.sex !== "牡");

  return (
    <div className="screen">
      <button className="link-btn back" onClick={() => go("home")}>
        ‹ 厩舎
      </button>
      <h2 className="screen-title">配合プランナー</h2>
      <p className="muted small">父・母を選ぶと、継承型からブレ幅の目安を表示します。</p>

      <div className="field">
        <label className="field-label">父</label>
        <select className="text-input" value={refToValue(sire)} onChange={(e) => setSire(valueToRef(e.target.value))}>
          <option value="none">未選択</option>
          <optgroup label="CPU種牡馬">
            {CPU_SIRES.map((c) => (
              <option key={c.id} value={`cpu:${c.id}`}>{c.name}</option>
            ))}
          </optgroup>
          {ownedSires.length > 0 && (
            <optgroup label="所有馬">
              {ownedSires.map((h) => (
                <option key={h.id} value={`owned:${h.id}`}>{h.name}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div className="field">
        <label className="field-label">母</label>
        <select className="text-input" value={refToValue(dam)} onChange={(e) => setDam(valueToRef(e.target.value))}>
          <option value="none">未選択</option>
          <optgroup label="CPU繁殖牝馬">
            {CPU_DAMS.map((c) => (
              <option key={c.id} value={`cpu:${c.id}`}>{c.name}</option>
            ))}
          </optgroup>
          {ownedDams.length > 0 && (
            <optgroup label="所有馬">
              {ownedDams.map((h) => (
                <option key={h.id} value={`owned:${h.id}`}>{h.name}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {(sireInfo || damInfo) && (
        <section className="panel">
          <div className="breed-compare">
            <ParentCol title="父" info={sireInfo} />
            <ParentCol title="母" info={damInfo} />
          </div>
        </section>
      )}

      {spread && (
        <section className={`panel spread-${spread.level}`}>
          <h3 className="section-head">産駒のブレ幅予想</h3>
          <p className="spread-label">{spread.label}</p>
          <p className="muted small">{spread.desc}</p>
        </section>
      )}

      {sireInfo && damInfo && (
        <button className="primary-btn full" onClick={() => go({ create: { sire, dam } })}>
          この配合で馬を登録へ
        </button>
      )}
    </div>
  );
}

function ParentCol({ title, info }: { title: string; info: ParentInfo | null }) {
  return (
    <div className="breed-col">
      <div className="breed-col-head">{title}</div>
      {info ? (
        <>
          <div className="breed-name">{info.name}</div>
          <Row k="継承型" v={info.inheritType} />
          <Row k="成長" v={info.growth} />
          <Row k="距離" v={info.distance} />
          <Row k="ダート" v={info.dirtApt} />
          <Row k="気性" v={info.temper} />
          <Row k="毛色" v={info.coat} />
        </>
      ) : (
        <div className="muted small">未選択</div>
      )}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="breed-row">
      <span className="muted xsmall">{k}</span>
      <span className="xsmall">{v}</span>
    </div>
  );
}
