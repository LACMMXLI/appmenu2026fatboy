import React, { useEffect, useState } from 'react';
import { Star, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getSystemSettings, submitFeedback } from '@/lib/api';

interface GoogleReviewViewProps {
  onNavigate: (view: string) => void;
}

export function GoogleReviewView({ onNavigate }: GoogleReviewViewProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [googleUrl, setGoogleUrl] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // Mark as permanently dismissed so the modal doesn't show again
    localStorage.setItem('fatboy-google-review-dismissed', 'true');

    // Fetch google reviews url
    getSystemSettings()
      .then((data) => {
        if (data.google_reviews_url) {
          setGoogleUrl(data.google_reviews_url);
        }
      })
      .catch((err) => console.error('Error fetching settings for review:', err));
  }, []);

  const handleStarClick = (selected: number) => {
    setRating(selected);
    if (selected >= 4) {
      // Redirect to Google Maps reviews
      setIsRedirecting(true);
      
      // Submit feedback to DB too, so we keep track of 4-5 star clicks
      submitFeedback(selected, 'Redirigido a Google Reseñas')
        .catch((err) => console.error('Error saving 4/5 star feedback:', err));

      const targetLink = googleUrl || 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83dQkw';
      
      setTimeout(() => {
        window.open(targetLink, '_blank', 'noopener,noreferrer');
        setIsRedirecting(false);
        setIsDone(true);
      }, 1500);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    setIsSubmitting(true);
    try {
      await submitFeedback(rating, comment);
      setIsDone(true);
    } catch (err) {
      alert('Hubo un error al enviar tus comentarios. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full bg-white text-gray-800 flex flex-col font-sans relative overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {/* Google Logo text */}
          <span className="text-[17px] font-bold tracking-tight select-none">
            <span className="text-[#4285F4]">G</span>
            <span className="text-[#EA4335]">o</span>
            <span className="text-[#FBBC05]">o</span>
            <span className="text-[#4285F4]">g</span>
            <span className="text-[#34A853]">l</span>
            <span className="text-[#EA4335]">e</span>
            <span className="text-gray-500 font-normal ml-1.5 text-sm">Reseñas</span>
          </span>
        </div>
        <button 
          onClick={() => onNavigate('home')} 
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>
      </header>

      {/* Main Review Card */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50 overflow-y-auto no-scrollbar">
        <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col items-center text-center">
          
          {/* Logo / Mascot integration */}
          <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-200 p-1 mb-4 bg-gray-100 flex items-center justify-center shadow-inner">
            <img 
              src="/images/logo.png" 
              alt="Fatboy Logo" 
              className="w-full h-full object-contain"
            />
          </div>

          {!isDone && !isRedirecting && (
            <>
              <h2 className="text-lg font-bold text-gray-900 leading-tight mb-1">
                ¿Qué te pareció Fatboy Smash Burgers?
              </h2>
              <p className="text-xs text-gray-500 mb-5 max-w-[280px]">
                Tu opinión es muy importante para nosotros. Califícanos con estrellas.
              </p>

              {/* Star Rating Row */}
              <div className="flex gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const isFilled = rating ? starValue <= rating : hoverRating ? starValue <= hoverRating : false;
                  return (
                    <button
                      key={starValue}
                      type="button"
                      onMouseEnter={() => setHoverRating(starValue)}
                      onMouseLeave={() => setHoverRating(null)}
                      onClick={() => handleStarClick(starValue)}
                      className="transition-transform active:scale-125 focus:outline-none p-0.5"
                    >
                      <Star
                        size={32}
                        className={isFilled ? 'text-[#F4B400]' : 'text-gray-300'}
                        fill={isFilled ? 'currentColor' : 'none'}
                        strokeWidth={1.5}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Internal Feedback Form (1-3 stars) */}
              {rating !== null && rating <= 3 && (
                <form onSubmit={handleSubmitFeedback} className="w-full text-left space-y-4 animate-fade-in">
                  <div className="border border-gray-300 rounded-lg p-3 focus-within:border-[#4285F4] transition-colors bg-white">
                    <label className="block text-[10px] font-bold text-[#4285F4] uppercase tracking-wide mb-1">
                      Comentarios del servicio
                    </label>
                    <textarea
                      placeholder="Comparte detalles de tu experiencia para ayudarnos a mejorar..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      required
                      className="w-full text-xs text-gray-800 bg-transparent outline-none resize-none h-20 placeholder-gray-400 font-sans"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-[#4285F4] hover:bg-[#357AE8] text-white font-sans text-xs font-bold uppercase rounded-lg py-2.5 h-10 shadow-none border-none transition-colors"
                    isLoading={isSubmitting}
                  >
                    Enviar comentarios
                  </Button>
                </form>
              )}
            </>
          )}

          {isRedirecting && (
            <div className="py-8 flex flex-col items-center justify-center animate-fade-in text-center">
              <div className="relative w-12 h-12 mb-4">
                <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-t-[#4285F4] rounded-full animate-spin"></div>
              </div>
              <h3 className="text-md font-bold text-gray-900 mb-1">Redirigiendo a Google</h3>
              <p className="text-xs text-gray-500 max-w-[240px]">
                ¡Muchísimas gracias por tu apoyo! Te estamos abriendo la página oficial de reseñas de Google Maps.
              </p>
            </div>
          )}

          {isDone && !isRedirecting && (
            <div className="py-6 flex flex-col items-center justify-center animate-fade-in">
              <CheckCircle size={44} className="text-[#34A853] mb-3" />
              <h3 className="text-md font-bold text-gray-900 mb-1">¡Gracias por tu calificación!</h3>
              <p className="text-xs text-gray-500 max-w-[240px] mb-6">
                Tus opiniones y sugerencias nos ayudan a preparar las mejores burgers smash para ti.
              </p>
              <Button 
                onClick={() => onNavigate('home')} 
                className="bg-[#4285F4] hover:bg-[#357AE8] text-white font-sans text-xs font-bold uppercase rounded-lg px-6 py-2 shadow-none border-none"
              >
                Volver al Inicio
              </Button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
