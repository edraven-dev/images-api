// Manual mock for file-type ESM module
export const fileTypeFromBuffer = jest.fn().mockResolvedValue({
  mime: 'image/jpeg',
  ext: 'jpg',
});
