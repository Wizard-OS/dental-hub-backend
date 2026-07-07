import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';

import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { JwtPayload } from './interfaces';
import { User } from './entities/user.entity';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import {
  CreateUserDto,
  LoginUserDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from './dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,

    private readonly jwtService: JwtService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const { password, ...userData } = createUserDto;

      const user = this.userRepository.create({
        ...userData,
        password: bcrypt.hashSync(password, 10),
      });

      await this.userRepository.save(user);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userWithoutPassword } = user;

      return this.buildAuthResponse(userWithoutPassword as User);
      // TODO: Retornar el JWT de acceso
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const { password, email } = loginUserDto;

    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        isActive: true,
        roles: true,
        phone: true,
        profilePhotoUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user)
      throw new UnauthorizedException('Credentials are not valid (email)');

    if (!bcrypt.compareSync(password, user.password))
      throw new UnauthorizedException('Credentials are not valid (password)');

    return this.buildAuthResponse(user);
  }

  async checkAuthStatus(user: User) {
    return this.buildAuthResponse(user);
  }

  async updateProfilePhoto(
    user: User,
    file: Express.Multer.File,
    baseUrl: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const profilePhotoUrl = `${baseUrl}/uploads/profile-photos/${file.filename}`;
    await this.userRepository.update(user.id, { profilePhotoUrl });

    const updatedUser = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!updatedUser) {
      throw new InternalServerErrorException('User not found');
    }

    return this.buildAuthResponse(updatedUser);
  }

  async updateProfile(user: User, updateProfileDto: UpdateProfileDto) {
    const { email, ...rest } = updateProfileDto;

    if (email && email !== user.email) {
      const existing = await this.userRepository.findOne({
        where: { email: email.toLowerCase().trim() },
      });
      if (existing && existing.id !== user.id) {
        throw new BadRequestException('Email already in use');
      }
    }

    await this.userRepository.update(user.id, {
      ...rest,
      ...(email ? { email: email.toLowerCase().trim() } : {}),
    });

    const updatedUser = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!updatedUser) {
      throw new InternalServerErrorException('User not found after update');
    }

    return this.buildAuthResponse(updatedUser);
  }

  async changePassword(user: User, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const userWithPassword = await this.userRepository.findOne({
      where: { id: user.id },
      select: { id: true, password: true },
    });

    if (!userWithPassword) {
      throw new InternalServerErrorException('User not found');
    }

    if (!bcrypt.compareSync(currentPassword, userWithPassword.password)) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.userRepository.update(user.id, {
      password: bcrypt.hashSync(newPassword, 10),
    });

    return {
      message: 'Password changed successfully',
      token: this.getJwtToken({ id: user.id }),
    };
  }

  async getProfile(user: User) {
    const fullUser = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!fullUser) {
      throw new InternalServerErrorException('User not found');
    }

    return this.buildAuthResponse(fullUser);
  }

  logout() {
    return {
      message: 'Logged out successfully',
    };
  }

  private getJwtToken(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  private async buildAuthResponse(user: User) {
    const userWithoutPassword = { ...user } as Omit<User, 'password'> & {
      password?: string;
    };
    delete userWithoutPassword.password;

    return {
      ...userWithoutPassword,
      memberships: await this.getActiveMemberships(user.id),
      token: this.getJwtToken({ id: user.id }),
    };
  }

  private async getActiveMemberships(userId: string) {
    const memberships = await this.clinicMembershipRepository.find({
      where: { userId, isActive: true, clinic: { isActive: true } },
      relations: { clinic: true },
      order: { createdAt: 'ASC' },
    });

    return memberships.map((membership) => ({
      clinicId: membership.clinicId,
      clinicName: membership.clinic.name,
      membershipId: membership.id,
      role: membership.role,
      permissionsJson: membership.permissionsJson ?? {},
    }));
  }

  private handleDBErrors(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail);

    console.log(error);

    throw new InternalServerErrorException('Please check server logs');
  }
}
