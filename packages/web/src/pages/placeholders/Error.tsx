
import BrokenPage from '../../assets/error.svg'; 
const Error = () => {
  
    return (
      <div style={styles.errorContainer}>
      <img src={BrokenPage} alt="Página rota" style={styles.image} />
        <h2 style={styles.title}>¡Ups! Algo salió mal</h2>
       <p style={styles.message}>
          {"No pudimos cargar la información. Intentá nuevamente."}
        </p>
        <button onClick={() => window.location.reload()} style={styles.button}>
          Reintentar
        </button>
      </div>
    );
};

const styles = {
  center: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    width: '100%',
  },
  errorContainer: {
    display: 'flex',
    flexdirection: 'column',
    gap: '1rem',
    textalign: 'center',
    padding: '2rem',
    height: '100vh',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '240px',
    maxWidth: '100%',
  },
  title: {
    margin: 0,
    fontSize: '1.8rem',
    fontWeight: 600,
  },
  message: {
    fontSize: '1rem',
    maxWidth: '400px',
  },
  button: {
    marginTop: '1rem',
    padding: '0.6rem 1.5rem',
    fontSize: '1rem',
    backgroundColor: '#000',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};

export default Error;
