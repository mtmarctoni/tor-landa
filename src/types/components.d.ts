// Component prop types that might be reused across multiple components

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface SimpleModalProps {
  onClose: () => void;
}

export interface BaseComponentProps {
  children?: React.ReactNode;
  className?: string;
}

// Extended modal props for specific use cases
export interface BirthdaySecretModalProps extends BaseModalProps {
  onSuccess: () => void;
}

export interface BirthdayGalleryModalProps extends BaseModalProps {
  // No additional props needed for gallery modal
}
