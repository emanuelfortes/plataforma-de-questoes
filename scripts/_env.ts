// Importe este arquivo PRIMEIRO em todo script. Carrega .env.local e depois .env.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });
