import { Action, Module, Mutation, VuexModule } from 'vuex-module-decorators'
import AuthService from '@/services/AuthService'
import UserService from '@/services/UserService'

export interface AuthUser {
  username: string
  idToken: string
  refreshToken: string
  policy_accepted: string
  isExpired: boolean
}

const storedUser = localStorage.getItem('user')

@Module({ namespaced: true })
class Auth extends VuexModule {
  public status = storedUser ? { loggedIn: true } : { loggedIn: false }
  public user: AuthUser | null = storedUser ? JSON.parse(storedUser) : null

  get isLoggedIn(): boolean {
    if (!this.status.loggedIn) {
      return false
    } else {
      return !this.isExpired
    }
  }

  get isExpired(): boolean {
    if (!this.user) return true // ユーザ情報が無い場合も expired したこととする
    return this.user.isExpired
  }

  get isPolicyAccepted(): boolean {
    return this.user?.policy_accepted !== undefined
  }

  @Mutation
  public loginSuccess(user: AuthUser): void {
    this.status.loggedIn = true
    localStorage.setItem('user', JSON.stringify(user))
    this.user = user
  }
  @Mutation
  public updateIdToken(idToken: string): void {
    if (this.user) {
      this.user.idToken = idToken
      localStorage.setItem('user', JSON.stringify(this.user))
    }
  }

  @Mutation
  public setIsExpired(expired: boolean): void {
    if (this.user) {
      this.user.isExpired = expired
      localStorage.setItem('user', JSON.stringify(this.user))
    }
  }

  @Mutation
  public loginFailure(): void {
    this.status.loggedIn = false
    this.user = null
    localStorage.removeItem('user')
  }

  @Mutation
  public logout(): void {
    this.status.loggedIn = false
    this.user = null
    localStorage.removeItem('user')
  }

  @Action({ rawError: true })
  login(loginKey: string): Promise<AuthUser> {
    return AuthService.login(loginKey).then(
      (user) => {
        this.context.commit('loginSuccess', user)
        return Promise.resolve(user)
      },
      (error) => {
        this.context.commit('loginFailure')
        const message =
          (error.response &&
            error.response.data &&
            error.response.data.errorMessage) ||
          error.message ||
          error.toString()
        return Promise.reject(message)
      },
    )
  }
  @Action({ rawError: true })
  checkIsExpired(): Promise<boolean> {
    if (!this.user) return Promise.resolve(false)
    const idToken: string = this.user?.idToken
    const bpayload = idToken.split('.')[1]
    const payload = JSON.parse(atob(bpayload))
    const expired = new Date() > new Date(payload.exp * 1000)
    this.context.commit('setIsExpired', expired)
    return Promise.resolve(expired)
  }

  @Action({ rawError: true })
  loginWithID(user: { username: string; password: string }): Promise<AuthUser> {
    return AuthService.loginWithID(user.username, user.password).then(
      (user) => {
        this.context.commit('loginSuccess', user)
        return Promise.resolve(user)
      },
      (error) => {
        this.context.commit('loginFailure')
        const message =
          (error.response &&
            error.response.data &&
            error.response.data.errorMessage) ||
          error.message ||
          error.toString()
        return Promise.reject(message)
      },
    )
  }
  @Action({ rawError: true })
  async sendLoginURL(
    phone: string,
  ): Promise<{ success: boolean; loginKey: string | undefined }> {
    try {
      return await AuthService.sendLoginURL(phone)
    } catch (err) {
      console.error(err)
      return { success: false, loginKey: undefined }
    }
  }

  @Action({ rawError: true })
  loginWithToken(token: string): Promise<AuthUser> {
    return AuthService.loginWithToken(token).then(
      (user) => {
        return Promise.resolve(user)
      },
      (error) => {
        this.context.commit('loginFailure')
        const message =
          (error.response &&
            error.response.data &&
            error.response.data.errorMessage) ||
          error.message ||
          error.toString()
        return Promise.reject(message)
      },
    )
  }

  @Action({ rawError: true })
  refreshToken(): Promise<AuthUser> {
    const token: string = this.user?.refreshToken || ''
    return AuthService.refreshToken(token).then(
      (idToken) => {
        this.context.commit('updateIdToken', idToken)
        if (this.user) {
          return Promise.resolve(this.user)
        } else {
          return Promise.reject('user data was broken')
        }
      },
      (error) => {
        this.context.commit('loginFailure')
        const message =
          (error.response &&
            error.response.data &&
            error.response.data.errorMessage) ||
          error.message ||
          error.toString()
        return Promise.reject(message)
      },
    )
  }

  @Action
  signOut(): void {
    this.context.commit('logout')
  }

  @Action({ rawError: true })
  acceptPolicy(): Promise<AuthUser> {
    return UserService.postAcceptPolicy().then(
      (result) => {
        if (this.user) {
          this.user.policy_accepted = result.policy_accepted
          localStorage.setItem('user', JSON.stringify(this.user))
        }
        return Promise.resolve(result)
      },
      (error) => {
        const message =
          (error.response &&
            error.response.data &&
            error.response.data.errorMessage) ||
          error.message ||
          error.toString()
        return Promise.reject(message)
      },
    )
  }
}

export default Auth
