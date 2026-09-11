/** A comment/media failure the API can show as-is, carrying its HTTP status. */
export class CommentError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'CommentError';
  }
}
