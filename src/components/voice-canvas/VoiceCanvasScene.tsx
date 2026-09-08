import { Camera, Check, CircleAlert, LoaderCircle, MapPin, Trash2, type LucideIcon } from "lucide-react";
import { useEffect, useRef, type ChangeEvent, type KeyboardEvent } from "react";
import ZamoraVoiceOrb, { type ZamoraOrbState } from "@/components/ZamoraVoiceOrb";
import type { VoiceCanvasAgentPresence, VoiceCanvasChoice, VoiceCanvasOptionCardBlock, VoiceCanvasViewModel } from "./types";
import "./voice-canvas.css";

export interface VoiceCanvasSceneProps {
  viewModel: VoiceCanvasViewModel;
  onChoice?: (choiceId: string) => void;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onTextChange?: (value: string) => void;
  onFileChange?: (file: File | null) => void;
  className?: string;
}

const statusIcons: Partial<Record<VoiceCanvasViewModel["kind"], LucideIcon>> = {
  completed: Check,
  blocked: CircleAlert,
  waiting: LoaderCircle,
};

function orbStateForAgentPresence(state: VoiceCanvasAgentPresence["state"]): ZamoraOrbState {
  if (state === "listening") return "listening";
  if (state === "speaking") return "speaking";
  return "idle";
}

function AgentPresence({ presence, sceneId }: { presence: VoiceCanvasAgentPresence; sceneId: string }) {
  const ariaLive = presence.ariaLive ?? "off";
  return (
    <div
      className="vc-agent-presence"
      data-state={presence.state}
      role={ariaLive === "off" ? undefined : "status"}
      aria-live={ariaLive === "off" ? undefined : ariaLive}
      aria-label={presence.accessibleLabel}
    >
      <span className="vc-agent-orb" aria-hidden="true">
        <ZamoraVoiceOrb state={orbStateForAgentPresence(presence.state)} size={52} isDark={false} testId={`voice-canvas-agent-orb-${sceneId}`} />
      </span>
      <span className="vc-agent-copy">
        <span className="vc-agent-label">{presence.label}</span>
        {presence.description && <span className="vc-agent-description">{presence.description}</span>}
      </span>
      <span className="vc-agent-bars" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

function ChoiceButton({ choice, onChoice }: { choice: VoiceCanvasChoice; onChoice?: (id: string) => void }) {
  const Icon = choice.icon ?? MapPin;
  return (
    <button
      type="button"
      className="vc-choice"
      data-selected={choice.selected || undefined}
      data-spoken-selected={choice.spokenSelected || undefined}
      aria-pressed={choice.selected}
      aria-label={choice.accessibleLabel}
      disabled={choice.disabled}
      onClick={() => onChoice?.(choice.id)}
    >
      <span className="vc-choice-icon" aria-hidden="true"><Icon size={24} strokeWidth={1.8} /></span>
      <span className="vc-choice-copy">
        <span className="vc-choice-label">{choice.label}</span>
        {choice.description && <span className="sr-only">{choice.description}</span>}
      </span>
      {choice.selected && <Check className="vc-choice-check" size={24} aria-hidden="true" />}
    </button>
  );
}

function OptionCardBlock({ block, onChoice }: { block: VoiceCanvasOptionCardBlock; onChoice?: (id: string) => void }) {
  const Icon = block.icon ?? MapPin;
  return (
    <button
      type="button"
      className="vc-option-card"
      data-selected={block.selected || undefined}
      data-spoken-selected={block.spokenSelected || undefined}
      data-recommended={block.recommended || undefined}
      aria-pressed={block.selected}
      aria-label={block.accessibleLabel}
      disabled={block.disabled}
      onClick={() => onChoice?.(block.id)}
    >
      <span className="vc-option-card-top">
        <span className="vc-option-card-icon" aria-hidden="true"><Icon size={24} strokeWidth={1.8} /></span>
        <span className="vc-option-card-copy">
          <span className="vc-option-card-title">{block.title}</span>
          {block.subtitle && <span className="vc-option-card-subtitle">{block.subtitle}</span>}
        </span>
        {block.badge && <span className="vc-option-card-badge">{block.badge}</span>}
        {block.selected && <Check className="vc-option-card-check" size={24} aria-hidden="true" />}
      </span>
      {block.description && <span className="vc-option-card-description">{block.description}</span>}
      {block.details && block.details.length > 0 && (
        <dl className="vc-option-card-details">
          {block.details.map((detail) => (
            <div key={detail.id ?? detail.label} data-tone={detail.tone ?? "neutral"}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </button>
  );
}

export function VoiceCanvasScene({ viewModel, onChoice, onPrimary, onSecondary, onTextChange, onFileChange, className = "" }: VoiceCanvasSceneProps) {
  const { kind, title, helperText, agentPresence, spokenChoiceFeedback, progress, choices = [], blocks = [], summaryRows = [], textEntry, fileEntry, statusLabel } = viewModel;
  const sectionRef = useRef<HTMLElement>(null);
  const StatusIcon = statusIcons[kind];
  const isWaiting = kind === "waiting" || viewModel.status === "loading";
  const titleId = `voice-canvas-title-${viewModel.sceneId}`;
  const helperId = helperText ? `voice-canvas-helper-${viewModel.sceneId}` : undefined;

  const handleChoiceKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowRight" && event.key !== "ArrowUp" && event.key !== "ArrowLeft") return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0 || buttons.length < 2) return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    buttons[(current + direction + buttons.length) % buttons.length].focus();
  };

  const handleTextChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onTextChange?.(event.target.value);

  useEffect(() => {
    if (!spokenChoiceFeedback) return;
    sectionRef.current
      ?.querySelector<HTMLElement>("[data-spoken-selected='true']")
      ?.focus();
  }, [spokenChoiceFeedback]);

  return (
    <section
      ref={sectionRef}
      className={`voice-canvas ${className}`.trim()}
      data-kind={kind}
      data-status={viewModel.status ?? "idle"}
      data-agent-presence={agentPresence ? "true" : undefined}
      data-agent-state={agentPresence?.state}
      aria-labelledby={titleId}
      aria-describedby={helperId}
      aria-busy={isWaiting}
    >
      {agentPresence && <AgentPresence presence={agentPresence} sceneId={viewModel.sceneId} />}

      {spokenChoiceFeedback && (
        <p className="vc-spoken-feedback" role="status" aria-live="polite" aria-atomic="true">
          {spokenChoiceFeedback.accessibleMessage ?? spokenChoiceFeedback.message}
        </p>
      )}

      {progress && (
        <div className="vc-progress" aria-label={progress.label} role="progressbar" aria-valuemin={1} aria-valuemax={progress.total} aria-valuenow={progress.current}>
          <span className="vc-progress-label">{progress.label}</span>
          <span className="vc-progress-track" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, progress.current / progress.total * 100))}%` }} /></span>
        </div>
      )}

      <div className="vc-content">
        {kind === "listening" && (
          <div className="vc-orb-wrap" aria-hidden="true"><ZamoraVoiceOrb state="listening" size={92} isDark={false} testId={`voice-canvas-orb-${viewModel.sceneId}`} /></div>
        )}
        {StatusIcon && (
          <span className="vc-status-icon" data-icon={kind} aria-hidden="true"><StatusIcon size={32} strokeWidth={1.8} /></span>
        )}
        {statusLabel && <p className="vc-eyebrow" role={isWaiting ? "status" : undefined}>{statusLabel}</p>}
        <h2 id={titleId} tabIndex={-1}>{title}</h2>
        {helperText && <p id={helperId} className="vc-helper">{helperText}</p>}

        {choices.length > 0 && <div className="vc-choices" role="group" aria-label={title} onKeyDown={handleChoiceKeyDown}>{choices.map((choice) => <ChoiceButton key={choice.id} choice={choice} onChoice={onChoice} />)}</div>}

        {blocks.length > 0 && (
          <div className="vc-blocks" role="group" aria-label={title} onKeyDown={handleChoiceKeyDown}>
            {blocks.map((block) => {
              if (block.kind === "option-card") return <OptionCardBlock key={block.id} block={block} onChoice={onChoice} />;
              return null;
            })}
          </div>
        )}

        {textEntry && (
          <label className="vc-field">
            <span>{textEntry.label}</span>
            {textEntry.multiline ? (
              <textarea value={textEntry.value} placeholder={textEntry.placeholder} maxLength={textEntry.maxLength} disabled={textEntry.disabled} aria-label={textEntry.accessibleLabel} onChange={handleTextChange} rows={4} />
            ) : (
              <input value={textEntry.value} placeholder={textEntry.placeholder} maxLength={textEntry.maxLength} disabled={textEntry.disabled} aria-label={textEntry.accessibleLabel} inputMode={textEntry.inputMode} type={textEntry.type ?? "text"} onChange={handleTextChange} />
            )}
          </label>
        )}

        {fileEntry && (
          <div className="vc-file-entry">
            <label className="vc-file-button">
              <Camera size={22} aria-hidden="true" />
              <span>{fileEntry.label}</span>
              <input
                type="file"
                accept={fileEntry.accept}
                capture={fileEntry.capture}
                disabled={fileEntry.disabled}
                aria-label={fileEntry.accessibleLabel ?? fileEntry.label}
                onChange={(event) => onFileChange?.(event.target.files?.[0] ?? null)}
              />
            </label>
            {fileEntry.fileName && (
              <div className="vc-file-status" role="status">
                <span><Check size={18} aria-hidden="true" />{fileEntry.statusLabel || fileEntry.fileName}</span>
                {fileEntry.removeLabel && (
                  <button type="button" onClick={() => onFileChange?.(null)} aria-label={fileEntry.removeLabel} title={fileEntry.removeLabel}>
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {summaryRows.length > 0 && <dl className="vc-summary">{summaryRows.map((row) => <div key={row.id}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>}

        {(viewModel.primaryAction || viewModel.secondaryAction) && (
          <div className="vc-actions">
            {viewModel.primaryAction && <button type="button" className="vc-primary" disabled={viewModel.primaryAction.disabled || viewModel.primaryAction.loading} aria-label={viewModel.primaryAction.accessibleLabel} onClick={onPrimary}>{viewModel.primaryAction.loading && <LoaderCircle className="vc-spin" size={22} aria-hidden="true" />}<span>{viewModel.primaryAction.label}</span></button>}
            {viewModel.secondaryAction && <button type="button" className="vc-secondary" disabled={viewModel.secondaryAction.disabled || viewModel.secondaryAction.loading} aria-label={viewModel.secondaryAction.accessibleLabel} onClick={onSecondary}>{viewModel.secondaryAction.label}</button>}
          </div>
        )}
      </div>
    </section>
  );
}

export default VoiceCanvasScene;
