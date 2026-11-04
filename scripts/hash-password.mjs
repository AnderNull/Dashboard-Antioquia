// Genera el PasswordHash (bcrypt) para la pestaña Usuarios_Autorizados.
// Uso: npm run hash-password -- "MiContraseñaSegura"
import bcrypt from "bcryptjs";

const pwd = process.argv[2];
if (!pwd || pwd.length < 8) {
  console.error('Uso: npm run hash-password -- "contraseña (mín. 8 caracteres)"');
  process.exit(1);
}
console.log(bcrypt.hashSync(pwd, 12));
