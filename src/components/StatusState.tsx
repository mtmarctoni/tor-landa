import { motion } from "framer-motion";

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
  icon,
  title,
  animatedTitle,
  description,
  footerMessage,
  actionLabel,
  onAction,

}) => {

  return (
    <motion.div
      className="surface-card flex w-full max-w-2xl flex-col items-center justify-center px-5 py-8 text-center sm:px-8 sm:py-12"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7 }}
    >
      <motion.div
        animate={{ rotate: [0, 360, 0], scale: [1, 1.3, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="mb-4 sm:mb-6"
      >
        <span className="select-none text-5xl sm:text-6xl" role="img" aria-label="calendar">
          {icon}
        </span>
      </motion.div>
      <h2 className="mb-2 text-[1.7rem] font-bold leading-tight text-dream-800 sm:text-2xl">
        {title}
      </h2>
      <motion.div
        className="mb-3 sm:mb-4"
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      >
        {animatedTitle && (
          <span className="select-none text-2xl font-extrabold text-dream-500 drop-shadow sm:text-3xl">
            {animatedTitle}
          </span>
        )}
      </motion.div>
      {description && (
        <p className="mb-4 max-w-xl whitespace-pre-line text-base leading-7 text-dream-700 sm:text-lg">
          {description}
        </p>
      )}
      {onAction && actionLabel && (
        <motion.button
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.95, rotate: -5 }}
          className="rounded-full bg-dream-200 px-6 py-3 text-sm font-semibold text-dream-800 shadow transition-colors hover:bg-dream-300 sm:text-base"
          onClick={onAction}
        >
          {actionLabel}
        </motion.button>
      )}
      <motion.div
        className="mt-6 sm:mt-8"
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
      >
        <span className="select-none text-3xl" role="img" aria-label="sparkles">
          ✨
        </span>
      </motion.div>
      {footerMessage && (
        <p className="mt-4 max-w-sm text-center italic text-dream-500">
          {footerMessage}
        </p>
      )}
    </motion.div>
  );
};

export default StatusState;
