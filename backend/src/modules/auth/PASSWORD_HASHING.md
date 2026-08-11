# Formatos de contraseña

El módulo de autenticación reconoce dos formatos durante la migración progresiva:

- Legado PBKDF2-SHA512: `<salt hexadecimal de 32 caracteres>:<clave hexadecimal de 128 caracteres>`. Este formato corresponde a 1,000 iteraciones y solo se conserva para validar cuentas existentes.
- Actual Argon2id: cadena PHC que comienza con `$argon2id$` e incluye versión, parámetros, salt y hash.

Los registros y cambios de contraseña generan únicamente Argon2id. Cuando un inicio de sesión valida correctamente un hash PBKDF2 legado, el servicio genera Argon2id y reemplaza el hash de forma condicional antes de crear la sesión.

Parámetros Argon2id actuales: 19,456 KiB de memoria, 2 iteraciones y paralelismo 1.
