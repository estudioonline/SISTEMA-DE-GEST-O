update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg','image/png','image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]
where id='comprovantes-pagamento';
