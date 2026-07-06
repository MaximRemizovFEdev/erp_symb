ERP for symb


## Development admin

Seed data includes a development admin user for local MVP work:

- username: `admin`
- password: `admin123`

The password itself is not stored in `data/users.json`; only a PBKDF2 password hash is stored. Override seeded credentials by setting `DEV_ADMIN_PASSWORD_HASH` before running `npm run seed`.
