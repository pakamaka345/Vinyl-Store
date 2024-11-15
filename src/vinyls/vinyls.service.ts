import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { GetSearchVinyls, GetVinyls } from './types';
import {
    CreateVinylRecordDto,
    CreateVinylRecordFromDiscogsDto,
    GetSearchVinylsDto,
    GetVinylsDto,
    UpdateVinylRecordDto,
} from './dto';
import { S3Service } from 'src/common';
import { Vinyl } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class VinylsService {
    public constructor(
        private readonly s3Service: S3Service,
        private readonly prismaService: PrismaService,
        private readonly configService: ConfigService,
    ) {}

    async getVinyls(query: GetVinylsDto): Promise<GetVinyls[]> {
        const { limit, offset } = query;

        const vinyls = await this.prismaService.vinyl.findMany({
            take: limit,
            skip: offset,
            include: {
                reviews: true,
            },
        });

        const vinylsResponse: GetVinyls[] = vinyls.map((vinyl) => ({
            id: vinyl.id,
            name: vinyl.name,
            authorName: vinyl.authorName,
            description: vinyl.description,
            price: vinyl.price,
            firstReview: vinyl.reviews[0]?.comment || null,
            averageScore:
                vinyl.reviews.length > 0
                    ? vinyl.reviews.reduce(
                        (acc, review) => acc + review.score,
                        0
                    ) / vinyl.reviews.length
                    : null,
        }));

        return vinylsResponse;
    }

    async searchVinyls(query: GetSearchVinylsDto): Promise<GetSearchVinyls[]> {
        const { limit, offset, order, sortBy, name, authorName } = query;

        const vinyls = await this.prismaService.vinyl.findMany({
            take: limit,
            skip: offset,
            orderBy: {
                [sortBy]: order,
            },
            where: {
                name: {
                    contains: name,
                },
                authorName: {
                    contains: authorName,
                },
            },
        });

        const vinylsResponse: GetSearchVinyls[] = vinyls.map((vinyl) => {
            return {
                id: vinyl.id,
                name: vinyl.name,
                authorName: vinyl.authorName,
                description: vinyl.description,
                price: vinyl.price,
                image: vinyl.image,
            };
        });

        return vinylsResponse;
    }

    async getVinyl(id: number): Promise<Vinyl> {
        const vinyl = await this.prismaService.vinyl.findUnique({
            where: { id },
            include: {
                reviews: true,
            },
        });

        if (!vinyl) {
            throw new HttpException('Vinyl not found', 404);
        }

        return vinyl;
    }

    async createVinyl(
        createVinylRecordDto: CreateVinylRecordDto,
        coverImage: Express.Multer.File
    ): Promise<Vinyl> {
        const { name, authorName, description, price } = createVinylRecordDto;

        if (!coverImage) {
            throw new HttpException('Cover image is required', 400);
        }

        const url = await this.s3Service.uploadFile(coverImage);

        const vinyl = await this.prismaService.vinyl.create({
            data: {
                name,
                authorName,
                description,
                price: price,
                image: url,
            },
        });

        if (!vinyl) {
            await this.s3Service.deleteFile(url);
            throw new HttpException('Vinyl cannot be created', 500);
        }

        return vinyl;
    }

    async createVinylFromDiscogs(query: CreateVinylRecordFromDiscogsDto): Promise<Vinyl[]> {
        const { vinylIds } = query;
        const discogsUrl = this.configService.get<string>('DISCOGS_API_URL');
        const discogsToken = this.configService.get<string>('DISCOGS_TOKEN');

        const vinyls = await Promise.all(
            vinylIds.map(async (vinylId) => {
                const existingVinyl = await this.prismaService.vinyl.findUnique({
                    where: { id: vinylId },
                });

                if (existingVinyl) {
                    return existingVinyl;
                } else {
                    const { data } = await axios.get(`${discogsUrl}/releases/${vinylId}`, {
                        headers: {
                            Authorization: `Discogs token=${discogsToken}`,
                        },
                    });

                    const newVinyl = await this.prismaService.vinyl.create({
                        data: {
                            id: vinylId,
                            name: data.title,
                            authorName: data.artists[0].name,
                            description: data.notes,
                            price: data.lowest_price,
                            image: data.images[0].uri,
                        },
                    });

                    if (!newVinyl) {
                        throw new HttpException('Vinyl cannot be created', 500);
                    }

                    return newVinyl;
                }
            })
        );

        return vinyls.filter((vinyl): vinyl is Vinyl => !!vinyl);
    }

    async updateVinyl(
        id: number,
        createVinylRecordDto: UpdateVinylRecordDto,
        coverImage?: Express.Multer.File
    ): Promise<Vinyl> {
        const { name, authorName, description, price } = createVinylRecordDto;

        const vinyl = await this.prismaService.vinyl.findUnique({
            where: { id },
        });

        if (!vinyl) {
            throw new HttpException('Vinyl not found', 404);
        }

        let url = vinyl.image;

        if (coverImage) {
            await this.s3Service.deleteFile(vinyl.image);
            url = await this.s3Service.uploadFile(coverImage);
        }

        const updatedVinyl = await this.prismaService.vinyl.update({
            where: { id },
            data: {
                name: name ?? vinyl.name,
                authorName: authorName ?? vinyl.authorName,
                description: description ?? vinyl.description,
                price: price ?? vinyl.price,
                image: url,
            },
        });

        if (!updatedVinyl) {
            throw new HttpException('Vinyl cannot be updated', 500);
        }

        return updatedVinyl;
    }

    async deleteVinyl(id: number) {
        const vinyl = await this.prismaService.vinyl.findUnique({
            where: { id },
        });

        if (!vinyl) {
            throw new HttpException('Vinyl not found', 404);
        }

        await this.s3Service.deleteFile(vinyl.image);

        await this.prismaService.vinyl.delete({
            where: { id },
        });
    }
}
