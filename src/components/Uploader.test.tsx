import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './Toast';

vi.mock('../lib/upload', () => ({
  uploadOne: vi.fn(),
  UploadCancelledError: class extends Error {},
}));

const { Uploader } = await import('./Uploader');

function renderUploader(uid: string | null = 'uid-1') {
  return render(
    <ToastProvider>
      <Uploader uid={uid} />
    </ToastProvider>,
  );
}

describe('<Uploader />', () => {
  it('shows previews and the send button for chosen files', async () => {
    const user = userEvent.setup();
    renderUploader();

    const input = screen.getByTestId('file-input');
    await user.upload(input, [
      new File(['x'], 'first.jpg', { type: 'image/jpeg' }),
      new File(['y'], 'second.png', { type: 'image/png' }),
    ]);

    expect(screen.getByAltText('first.jpg')).toBeInTheDocument();
    expect(screen.getByAltText('second.png')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /שלחו 2 קבצים/ })).toBeEnabled();
  });

  it('rejects an oversized video with a toast', async () => {
    const user = userEvent.setup();
    renderUploader();

    const huge = new File(['v'], 'big.mp4', { type: 'video/mp4' });
    Object.defineProperty(huge, 'size', { value: 60 * 1024 * 1024 });
    await user.upload(screen.getByTestId('file-input'), huge);

    expect(await screen.findByText(/big\.mp4: הסרטון גדול מדי/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ממתין לקבצים/ })).toBeDisabled();
  });

  it('keeps the send button disabled until sign-in completes', async () => {
    const user = userEvent.setup();
    renderUploader(null);

    await user.upload(
      screen.getByTestId('file-input'),
      new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
    );
    expect(screen.getByRole('button', { name: /שלחו קובץ אחד/ })).toBeDisabled();
  });
});
