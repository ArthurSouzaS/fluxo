'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { can, type Attachment, type BoardDetail, type CardDetail } from '@fluxo/shared';
import { attachmentsApi } from '@/lib/api/endpoints';
import { formatBytes, formatRelative } from '@/lib/format';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useCardActions } from '@/lib/useCardActions';
import { IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { errorMessage } from '../ui/States';
import { useToast } from '../ui/Toast';
import styles from './CardModal.module.scss';

/** Miniatura de imagem baixada com autenticação (o download exige o token). */
function Thumbnail({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.mimeType.startsWith('image/');
  const blob = useQuery({
    queryKey: ['attachment-blob', attachment.id],
    queryFn: async () => (await attachmentsApi.download(attachment.id)).blob(),
    enabled: isImage,
    staleTime: Infinity,
  });
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob.data) return;
    const objectUrl = URL.createObjectURL(blob.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob.data]);

  return (
    <span className={styles.thumb}>
      {url ? <img src={url} alt="" /> : <Icon name="file" size={20} />}
    </span>
  );
}

export function CardAttachments({ card, board }: { card: CardDetail; board: BoardDetail }) {
  const { user } = useAuth();
  const toast = useToast();
  const actions = useCardActions(card.id, board.id);

  if (card.attachments.length === 0) return null;

  const download = async (attachment: Attachment) => {
    try {
      const response = await attachmentsApi.download(attachment.id);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <section className={styles.section} aria-labelledby="card-attachments">
      <div className={styles.sectionHeader}>
        <h3 id="card-attachments" className={styles.sectionTitle}>
          <Icon name="paperclip" size={16} /> Anexos ({card.attachments.length})
        </h3>
      </div>
      <ul className={styles.attachments}>
        {card.attachments.map((attachment) => {
          const canRemove =
            can(board.myRole, 'attachment:moderate') ||
            (attachment.uploader?.id === user?.id && can(board.myRole, 'attachment:upload'));
          return (
            <li key={attachment.id} className={styles.attachment}>
              <Thumbnail attachment={attachment} />
              <span className={styles.attachmentInfo}>
                <span className={styles.attachmentName}>{attachment.fileName}</span>
                <span className={styles.muted}>
                  {formatBytes(attachment.size)} · {attachment.uploader?.name ?? 'Ex-membro'} ·{' '}
                  {formatRelative(attachment.createdAt)}
                </span>
              </span>
              <IconButton
                icon="download"
                size="sm"
                label={`Baixar ${attachment.fileName}`}
                onClick={() => void download(attachment)}
              />
              {canRemove ? (
                <IconButton
                  icon="trash"
                  size="sm"
                  label={`Remover ${attachment.fileName}`}
                  onClick={() => actions.removeAttachment.mutate(attachment.id)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
