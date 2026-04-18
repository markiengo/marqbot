"use client";

interface PlannerActionFrameProps {
  children: React.ReactNode;
  className?: string;
}

const FRAME_STYLE = {
  height: "calc(77vh - 8rem)",
  minHeight: "400px",
} as const;

const BASE_CLASSES = "-mx-8 -mt-8 flex flex-col overflow-hidden";

export function PlannerActionFrame({ children, className }: PlannerActionFrameProps) {
  const classes = className ? `${BASE_CLASSES} ${className}` : BASE_CLASSES;

  return (
    <div data-testid="planner-action-frame" className={classes} style={FRAME_STYLE}>
      {children}
    </div>
  );
}
