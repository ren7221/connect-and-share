import { motion } from "framer-motion";

interface PremiumLoaderProps {
  message?: string;
}

const PremiumLoader = ({ message = "Loading..." }: PremiumLoaderProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[120px] w-full gap-4">
      <div className="flex items-end gap-1.5 h-8">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="w-2 rounded-full bg-primary"
            style={{ height: 12 }}
            animate={{ height: [12, 32, 12] }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground font-medium tracking-wide">{message}</p>
    </div>
  );
};

export default PremiumLoader;
