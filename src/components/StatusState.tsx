interface StatusStateProps {
  icon: string;
  title: string;
  animatedTitle?: string;
  description?: string;
  footerMessage?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "default" | "danger" | "celebration";
}

const StatusState: React.FC<StatusStateProps> = ({
  title,
  animatedTitle,
  description,
  footerMessage,
  actionLabel,
  onAction,
}) => (
  <div className="journal-status">
    <span className="journal-eyebrow">Una página del diario</span>
    <h2>{title}</h2>
    {animatedTitle && <p className="journal-status-aside">{animatedTitle}</p>}
    {description && <p className="whitespace-pre-line">{description}</p>}
    {onAction && actionLabel && (
      <button
        type="button"
        className="control-pill my-4 border"
        onClick={onAction}
      >
        {actionLabel}
      </button>
    )}
    {footerMessage && (
      <p className="journal-status-aside whitespace-pre-line">
        {footerMessage}
      </p>
    )}
  </div>
);

export default StatusState;
