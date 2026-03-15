import { motion } from "framer-motion";

interface StatusStateProps {
  icon: string;
  title: string;
  animatedTitle: string;
  description?: string;
  footerMessage?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "default" | "danger" | "celebration";
}

const toneStyles = {
  default: {
    title: "text-dream-800",
    description: "text-dream-700",
    action: "bg-dream-200 text-dream-800 hover:bg-dream-300",
  },
  danger: {
    title: "text-rose-900",
    description: "text-rose-800",
    action: "bg-rose-200 text-rose-900 hover:bg-rose-300",
  },
  celebration: {
    title: "text-amber-900",
    description: "text-amber-800",
    action: "bg-amber-200 text-amber-900 hover:bg-amber-300",
  },
};

const StatusState: React.FC<StatusStateProps> = ({
  icon,
  title,
  animatedTitle,
  description,
  footerMessage,
  actionLabel,
  onAction,
  tone = "default",
}) => {
  const styles = toneStyles[tone];

  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7 }}
    >
      <motion.div
        animate={{ rotate: [0, 360, 0], scale: [1, 1.3, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="mb-6"
      >
        <span className="text-6xl select-none" role="img" aria-label="calendar">
          {icon}
        </span>
      </motion.div>
      <h2 className="text-2xl font-bold text-dream-700 mb-2 text-center">
        {title}
      </h2>
      <motion.div
        className="mb-4"
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      >
        <span className="text-3xl font-extrabold text-dream-500 drop-shadow animate-bounce select-none">
          {animatedTitle}
        </span>
      </motion.div>
      {description && (
        <p className="text-dream-600 text-lg mb-4 text-center max-w-xl whitespace-pre-line">
          {description}
        </p>
      )}
      <motion.div
        className="mt-8"
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
      >
        <span className="text-3xl select-none" role="img" aria-label="sparkles">
          ✨
        </span>
      </motion.div>
      {footerMessage && (
        <p className="mt-4 text-dream-500 italic text-center max-w-sm">
          {footerMessage}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className={`control-pill mt-6 ${styles.action}`}
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
};

export default StatusState;
