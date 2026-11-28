import React from 'react';
import { motion } from 'framer-motion';
import { Booking, ChatThread } from '../types';
import { Check, CheckCircle2, Clock, MessageSquare, Sparkles, XCircle } from 'lucide-react';

export type BookingWorkflowStage = 'requested' | 'negotiating' | 'confirmed' | 'completed';
export type BookingTerminalOutcome = 'declined' | 'cancelled' | null;

export interface BookingProgressState {
  stage: BookingWorkflowStage;
  stageIndex: number; // 0..3
  terminal: BookingTerminalOutcome;
  caption: string;
}

const WORKFLOW_STEPS: {
  key: BookingWorkflowStage;
  label: string;
}[] = [
  { key: 'requested', label: 'Requested' },
  { key: 'negotiating', label: 'Negotiating' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
];

export function deriveBookingProgress(
  booking?: Booking | null,
  thread?: ChatThread | null
): BookingProgressState {
  const todayStr = new Date().toISOString().slice(0, 10);
  const messages = thread?.messages || [];

  let threadOutcome: 'accepted' | 'declined' | 'pending' | null = null;
  let pendingOfferAmount: number | undefined;

  for (const m of messages) {
    if (m.type === 'offer' || m.type === 'counter') {
      if (m.status === 'accepted') {
        threadOutcome = 'accepted';
        pendingOfferAmount = undefined;
      } else if (m.status === 'declined') {
        threadOutcome = 'declined';
        pendingOfferAmount = undefined;
      } else {
        threadOutcome = 'pending';
        pendingOfferAmount = m.amount;
      }
    } else if (m.type === 'accept') {
      threadOutcome = 'accepted';
      pendingOfferAmount = undefined;
    } else if (m.type === 'decline') {
      threadOutcome = 'declined';
      pendingOfferAmount = undefined;
    }
  }

  const hasMessages = messages.length > 0;

  // 1. Completed: confirmed booking whose checkout date is in the past
  if (booking?.status === 'confirmed' && booking.checkOut && booking.checkOut < todayStr) {
    return {
      stage: 'completed',
      stageIndex: 3,
      terminal: null,
      caption: 'Stay completed',
    };
  }

  // 2. Cancelled booking
  if (booking?.status === 'cancelled') {
    const stoppedIndex = hasMessages ? 1 : 0;
    return {
      stage: stoppedIndex === 1 ? 'negotiating' : 'requested',
      stageIndex: stoppedIndex,
      terminal: 'cancelled',
      caption: 'Booking cancelled',
    };
  }

  // 3. Declined booking or declined offer
  if (booking?.status === 'declined' || (!booking && threadOutcome === 'declined')) {
    return {
      stage: 'negotiating',
      stageIndex: 1,
      terminal: 'declined',
      caption: booking?.status === 'declined' ? 'Booking declined by host' : 'Offer declined',
    };
  }

  // 4. Confirmed booking or accepted negotiation offer
  if (booking?.status === 'confirmed' || threadOutcome === 'accepted') {
    return {
      stage: 'confirmed',
      stageIndex: 2,
      terminal: null,
      caption:
        booking?.status === 'confirmed'
          ? 'Confirmed · Ready for check-in'
          : 'Offer accepted · Ready to confirm stay',
    };
  }

  // 5. Active negotiation
  if (hasMessages) {
    return {
      stage: 'negotiating',
      stageIndex: 1,
      terminal: null,
      caption:
        threadOutcome === 'pending' && pendingOfferAmount
          ? `Offer KES ${pendingOfferAmount.toLocaleString()}/night open`
          : 'Negotiating rate & stay details',
    };
  }

  // 6. Requested (default / awaiting host approval)
  if (booking?.status === 'requested') {
    return {
      stage: 'requested',
      stageIndex: 0,
      terminal: null,
      caption: 'Requested · Awaiting host approval',
    };
  }

  return {
    stage: 'requested',
    stageIndex: 0,
    terminal: null,
    caption: 'Send request or offer to begin',
  };
}

interface BookingStatusTrackerProps {
  booking?: Booking | null;
  thread?: ChatThread | null;
  variant?: 'header' | 'card';
  className?: string;
}

export const BookingStatusTracker: React.FC<BookingStatusTrackerProps> = ({
  booking,
  thread,
  variant = 'header',
  className = '',
}) => {
  const { stageIndex, terminal, caption } = deriveBookingProgress(booking, thread);

  const containerClasses =
    variant === 'header'
      ? 'px-4 py-3 bg-stone-50/90 dark:bg-stone-900/70 border-b border-stone-200 dark:border-stone-800'
      : 'p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800';

  const statusTextColor = terminal
    ? 'text-rose-600 dark:text-rose-400'
    : stageIndex >= 2
    ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-[#e4002b] dark:text-[#ff4d6d]';

  // Progress ratio across the 3 segments connecting the 4 step centers (0..1)
  const effectiveSegmentCount = WORKFLOW_STEPS.length - 1;
  const completedSegments = terminal ? Math.max(0, stageIndex - 1) : stageIndex;
  const progressRatio = Math.min(1, Math.max(0, completedSegments / effectiveSegmentCount));

  const renderStepIcon = (stepKey: BookingWorkflowStage, isDone: boolean, isCurrent: boolean) => {
    if (isCurrent && terminal) {
      return <XCircle className="w-3.5 h-3.5" />;
    }
    if (isDone) {
      return (
        <motion.span
          key="done"
          initial={{ scale: 0.65, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center"
        >
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
        </motion.span>
      );
    }
    switch (stepKey) {
      case 'requested':
        return <Clock className="w-3.5 h-3.5" />;
      case 'negotiating':
        return <MessageSquare className="w-3.5 h-3.5" />;
      case 'confirmed':
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'completed':
        return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div
      role="region"
      aria-label="Booking status tracker"
      className={`${containerClasses} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 whitespace-nowrap">
          Booking Status
        </span>
        <motion.span
          key={caption}
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={`text-[11px] font-bold truncate ${statusTextColor}`}
        >
          {caption}
        </motion.span>
      </div>

      <div className="relative">
        {/* Continuous base & animated progress track spanning step 1 center to step 4 center */}
        <div
          aria-hidden="true"
          className="absolute top-3 left-[12.5%] right-[12.5%] h-0.5 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden"
        >
          <motion.div
            className={`w-full h-full rounded-full ${
              terminal ? 'bg-rose-500/70' : 'bg-emerald-500'
            }`}
            initial={false}
            animate={{ scaleX: progressRatio }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'left center' }}
          />
        </div>

        <ol className="relative z-10 flex items-start w-full">
          {WORKFLOW_STEPS.map((step, idx) => {
            const isCompleted = !terminal && idx < stageIndex;
            const isPastBeforeTerminal = Boolean(terminal) && idx < stageIndex;
            const isDone = isCompleted || isPastBeforeTerminal;
            const isCurrent = idx === stageIndex;
            const isTerminatedHere = isCurrent && Boolean(terminal);

            const circleClass = isTerminatedHere
              ? 'bg-rose-600 text-white ring-4 ring-rose-500/20'
              : isDone
              ? 'bg-emerald-600 text-white'
              : isCurrent
              ? idx >= 2
                ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/20'
                : 'bg-[#e4002b] text-white ring-4 ring-[#e4002b]/20'
              : 'bg-stone-200 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-300 dark:border-stone-700';

            const labelClass = isTerminatedHere
              ? 'font-bold text-rose-600 dark:text-rose-400'
              : isDone
              ? 'font-semibold text-emerald-700 dark:text-emerald-400'
              : isCurrent
              ? idx >= 2
                ? 'font-bold text-emerald-700 dark:text-emerald-400'
                : 'font-bold text-stone-900 dark:text-white'
              : 'font-medium text-stone-400 dark:text-stone-500';

            const stepLabel =
              isTerminatedHere && terminal === 'declined'
                ? 'Declined'
                : isTerminatedHere && terminal === 'cancelled'
                ? 'Cancelled'
                : step.label;

            return (
              <li
                key={step.key}
                aria-current={isCurrent ? 'step' : undefined}
                className="flex-1 flex flex-col items-center min-w-0"
              >
                <motion.div
                  initial={false}
                  animate={{ scale: isCurrent ? 1.08 : 1 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors duration-200 ${circleClass}`}
                >
                  {renderStepIcon(step.key, isDone, isCurrent)}
                </motion.div>

                <span className={`mt-1.5 text-[11px] leading-tight whitespace-nowrap ${labelClass}`}>
                  {stepLabel}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
