import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

const USUARIOS = [
  { username: 'admin',   password: 'maddi2025' },
  { username: 'usuario', password: '1234' },
];

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  username = '';
  password = '';
  errorMsg = '';

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (localStorage.getItem('maddiplus-auth')) {
      this.router.navigate(['/visor']);
    }
  }

  onSubmit(): void {
    const match = USUARIOS.find(
      (u) => u.username === this.username && u.password === this.password
    );
    if (match) {
      localStorage.setItem('maddiplus-auth', '1');
      this.router.navigate(['/visor']);
    } else {
      this.errorMsg = 'Usuario o contraseña incorrectos.';
    }
  }
}
