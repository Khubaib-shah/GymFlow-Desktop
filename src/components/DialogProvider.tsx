import React, { createContext, useContext, useState, ReactNode } from 'react';

type DialogOptions = {
  title?: string;
  message: string;
  type?: 'alert' | 'confirm';
  resolve?: (value: boolean) => void;
};

type DialogContextType = {
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
};

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  const showAlert = (message: string, title?: string): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({
        type: 'alert',
        title: title || 'Notice',
        message,
        resolve: () => resolve(),
      });
    });
  };

  const showConfirm = (message: string, title?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        type: 'confirm',
        title: title || 'Confirmation',
        message,
        resolve,
      });
    });
  };

  const handleClose = (result: boolean) => {
    if (dialog && dialog.resolve) {
      dialog.resolve(result);
    }
    setDialog(null);
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {dialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 transition-opacity">
          <div className="glass w-full max-w-sm rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-3">
              {dialog.title}
            </h2>
            <p className="text-gray-300 mb-6 whitespace-pre-wrap">
              {dialog.message}
            </p>

            <div className="flex justify-end gap-3">
              {dialog.type === 'confirm' && (
                <button
                  onClick={() => handleClose(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => handleClose(true)}
                className={dialog.type === 'confirm' ? 'btn-primary bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20 border-red-500' : 'btn-primary'}
              >
                {dialog.type === 'confirm' ? 'Confirm' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
