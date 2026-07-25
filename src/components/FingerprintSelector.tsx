
import React from 'react';
import { Fingerprint, Trash2 } from 'lucide-react';

interface FingerprintSelectorProps {
  enrolledFingers: number[];
  onSelectFinger: (index: number) => void;
  onDeleteFinger?: (index: number) => void;
  onCancel: () => void;
}

export const FingerprintSelector: React.FC<FingerprintSelectorProps> = ({
  enrolledFingers,
  onSelectFinger,
  onDeleteFinger,
  onCancel,
}) => {
  const leftFingers = [
    { index: 0, label: 'L. Pinky', height: 'h-16' },
    { index: 1, label: 'L. Ring', height: 'h-20' },
    { index: 2, label: 'L. Middle', height: 'h-24' },
    { index: 3, label: 'L. Index', height: 'h-20' },
    { index: 4, label: 'L. Thumb', height: 'h-16', isThumb: true },
  ];

  const rightFingers = [
    { index: 5, label: 'R. Thumb', height: 'h-16', isThumb: true },
    { index: 6, label: 'R. Index', height: 'h-20' },
    { index: 7, label: 'R. Middle', height: 'h-24' },
    { index: 8, label: 'R. Ring', height: 'h-20' },
    { index: 9, label: 'R. Pinky', height: 'h-16' },
  ];

  const renderFinger = (finger: { index: number; label: string; height: string; isThumb?: boolean }, isLeft: boolean) => {
    const isEnrolled = enrolledFingers.includes(finger.index);

    return (
      <div
        key={finger.index}
        className={`flex flex-col items-center ${finger.isThumb ? (isLeft ? 'ml-6 mt-12 rotate-45' : 'mr-6 mt-12 -rotate-45') : ''}`}
      >
        <button
          onClick={() => {
            if (isEnrolled && onDeleteFinger) {
              if (window.confirm(`Are you sure you want to delete the enrolled ${finger.label} fingerprint?`)) {
                onDeleteFinger(finger.index);
              }
            } else if (!isEnrolled) {
              onSelectFinger(finger.index);
            }
          }}
          className={`
            w-10 sm:w-12 ${finger.height} rounded-t-full rounded-b-md border-2 transition-all relative overflow-hidden flex items-end justify-center pb-2 group
            ${isEnrolled
              ? 'bg-primary-500/20 border-primary-500 text-primary-400 cursor-pointer hover:bg-red-500/20 hover:border-red-500 hover:text-red-400'
              : 'bg-[#1a1d24] border-[#2a2e37] hover:border-blue-500 hover:bg-blue-500/10 text-gray-400 hover:text-blue-400 cursor-pointer shadow-lg'
            }
          `}
          title={isEnrolled ? `Delete ${finger.label}` : `Enroll ${finger.label}`}
        >
          {isEnrolled && (
            <>
              <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:hidden">
                <Fingerprint className="w-8 h-8" />
              </div>
              <div className="absolute inset-0 hidden items-center justify-center opacity-80 group-hover:flex">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
            </>
          )}
          <span className="text-xs font-bold z-10">{finger.index}</span>
        </button>
        <span className={`text-[10px] mt-2 text-gray-400 ${finger.isThumb ? (isLeft ? '-rotate-45' : 'rotate-45') : ''}`}>
          {finger.label}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto p-4 sm:p-6 bg-[#0f1115] rounded-xl border border-[#2a2e37]">
      <div className="text-center">
        <h3 className="text-xl font-bold text-white">Select Finger to Enroll</h3>
        <p className="text-sm text-gray-400 mt-2">Click on the specific finger you wish to enroll on the device.</p>
        <div className="mt-4 inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 px-4 py-2 rounded-full">
          <Fingerprint className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-medium text-primary-400">
            {enrolledFingers.length} {enrolledFingers.length === 1 ? 'fingerprint' : 'fingerprints'} enrolled
          </span>
        </div>
      </div>

      <div className="flex justify-between items-end gap-4 sm:gap-12 pt-8 pb-4">
        {/* Left Hand */}
        <div className="flex-1 flex flex-col items-center">
          <div className="flex items-end gap-1 sm:gap-2 relative">
            {leftFingers.filter(f => !f.isThumb).map(f => renderFinger(f, true))}
            {renderFinger(leftFingers.find(f => f.isThumb)!, true)}
            {/* Palm mock */}
            <div className="absolute -bottom-12 left-0 right-10 h-16 bg-[#1a1d24] border border-[#2a2e37] border-t-0 rounded-b-3xl -z-10"></div>
          </div>
          <h4 className="text-gray-500 font-semibold mt-16 text-sm">LEFT HAND</h4>
        </div>

        {/* Right Hand */}
        <div className="flex-1 flex flex-col items-center">
          <div className="flex items-end gap-1 sm:gap-2 relative">
            {renderFinger(rightFingers.find(f => f.isThumb)!, false)}
            {rightFingers.filter(f => !f.isThumb).map(f => renderFinger(f, false))}
            {/* Palm mock */}
            <div className="absolute -bottom-12 left-10 right-0 h-16 bg-[#1a1d24] border border-[#2a2e37] border-t-0 rounded-b-3xl -z-10"></div>
          </div>
          <h4 className="text-gray-500 font-semibold mt-16 text-sm">RIGHT HAND</h4>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4 border-t border-[#2a2e37] pt-4">
        <button onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
};
