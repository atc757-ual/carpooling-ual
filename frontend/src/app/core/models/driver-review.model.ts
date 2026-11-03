// Una reseña publicada de un conductor (GET /api/users/{id}/driver-reviews)
export interface DriverReview {
  id: string;
  author: { name: string; avatarKey: string | null };
  rating: number;
  comment: string | null;
  publishedAt: string;
}

// Media, número de reseñas y cuántas hay de cada estrella, de 5 a 1
// (GET /api/users/{id}/driver-rating)
export interface DriverRating {
  average: number | null;
  count: number;
  distribution: { rating: number; count: number }[];
}

export interface DriverReviewPage {
  items: DriverReview[];
  total: number;
}
